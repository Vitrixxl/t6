// Generateur d'option : transit.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { haversineDistanceKm, stopToPoint } from '../geo';
import { buildOption, createLeg } from '../legs';
import { findTransitJourney, transitLegs } from '../transit';

export function createTransitOption({ origin, destination, profile, network }: RouteRequest): RouteOption | null {
  const journey = findTransitJourney(network, origin, destination, profile.accessibilityNeed);
  if (!journey) {
    // Aucune ligne ne relie les deux points en une correspondance au plus, ou
    // aucune station accessible a proximite pour un profil PMR. On ne propose
    // pas un trajet qui n'existe pas.
    return null;
  }

  const boarding = journey.rides[0].boarding;
  const alighting = journey.rides[journey.rides.length - 1].alighting;
  const firstWalkKm = haversineDistanceKm(origin, stopToPoint(boarding));
  const lastWalkKm = haversineDistanceKm(stopToPoint(alighting), destination);
  const delayed = journey.rides.some((ride) => ride.waitMinutes > 4);

  const legs: RouteLeg[] = [
    createLeg({
      id: 'walk-to-stop',
      mode: 'walk',
      title: 'Approche pietonne',
      from: origin,
      to: stopToPoint(boarding),
      distanceKm: firstWalkKm,
      accessible: true,
    }),
    ...transitLegs(journey, 'transit'),
    createLeg({
      id: 'walk-from-stop',
      mode: 'walk',
      title: 'Derniers metres',
      from: stopToPoint(alighting),
      to: destination,
      distanceKm: lastWalkKm,
      accessible: true,
    }),
  ];

  const lines = journey.rides.map((ride) => ride.route.route_short_name).join(' puis ');

  return buildOption({
    id: 'transit',
    title: 'Transport en commun',
    summary:
      journey.rides.length > 1
        ? `Ligne ${lines} avec une correspondance a ${journey.rides[1].boarding.stop_name}.`
        : `Ligne ${lines} directe de ${boarding.stop_name} a ${alighting.stop_name}.`,
    modes: ['walk', 'transit'],
    legs,
    reliabilityScore: delayed ? 74 : 88,
    warnings: [],
  });
}
