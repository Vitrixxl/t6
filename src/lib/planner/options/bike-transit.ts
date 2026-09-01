// Generateur d'option : bike + transit.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { haversineDistanceKm, nearestStation, stationToPoint, stopToPoint } from '../geo';
import { buildOption, createLeg } from '../legs';
import { findTransitJourney, transitLegs } from '../transit';

export function createBikeTransitOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption | null {
  const stations = network.sharedMobility.data.stations.filter(
    (station) => station.is_installed && station.is_renting && station.is_returning && station.bikes_available > 0,
  );
  const fromStation = nearestStation(stations, origin);
  if (!fromStation) {
    return null;
  }

  // Le velo sert de rabattement : la recherche de trajet part donc de la
  // station Velo'v, pas du domicile. Sans cela, la station de montee choisie
  // serait celle du depart a pied, que le velo aurait deja depassee.
  const journey = findTransitJourney(network, stationToPoint(fromStation), destination, profile.accessibilityNeed);
  if (!journey) {
    return null;
  }

  const boarding = journey.rides[0].boarding;
  const alighting = journey.rides[journey.rides.length - 1].alighting;
  const firstWalkKm = haversineDistanceKm(origin, stationToPoint(fromStation));
  const bikeKm = Math.max(haversineDistanceKm(stationToPoint(fromStation), stopToPoint(boarding)) * 1.2, directKm * 0.22);
  const finalWalkKm = haversineDistanceKm(stopToPoint(alighting), destination);
  const trafficWarning = network.gtfs.incidents.find((incident) => incident.affected_modes.includes('transit'));
  const rainWarning = network.gtfs.weather.condition.includes('rain');
  const delayed = journey.rides.some((ride) => ride.waitMinutes > 4);

  const legs: RouteLeg[] = [
    createLeg({
      id: 'hybrid-walk-to-bike',
      mode: 'walk',
      title: 'Approche velo',
      from: origin,
      to: stationToPoint(fromStation),
      distanceKm: firstWalkKm,
      accessible: true,
    }),
    {
      ...createLeg({
        id: 'hybrid-bike-to-transit',
        mode: 'bike',
        title: 'Velo vers correspondance',
        from: stationToPoint(fromStation),
        to: stopToPoint(boarding),
        distanceKm: bikeKm,
        accessible: !profile.accessibilityNeed,
        estimate: { overheadMinutes: 2 },
      }),
      detail: `${fromStation.bikes_available} velos disponibles pour rejoindre la correspondance.`,
    },
    ...transitLegs(journey, 'hybrid'),
    createLeg({
      id: 'hybrid-walk-from-transit',
      mode: 'walk',
      title: 'Derniers metres',
      from: stopToPoint(alighting),
      to: destination,
      distanceKm: finalWalkKm,
      accessible: true,
    }),
  ];

  const lines = journey.rides.map((ride) => ride.route.route_short_name).join(' puis ');

  return buildOption({
    id: 'bike-transit',
    title: 'Velo + transport en commun',
    summary: `Velo partage jusqu'a ${boarding.stop_name}, puis ligne ${lines}.`,
    modes: ['walk', 'bike', 'transit'],
    legs,
    reliabilityScore: delayed || rainWarning ? 78 : 90,
    warnings: [
      ...(trafficWarning ? [trafficWarning.message] : []),
      ...(rainWarning && profile.avoidRain ? ['Pluie legere detectee sur la portion velo.'] : []),
    ],
  });
}
