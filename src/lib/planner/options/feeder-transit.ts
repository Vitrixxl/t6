// Option composee : un engin partage en rabattement, puis le transport public.
//
// Velo'v et trottinette suivent exactement le meme enchainement — marche vers
// l'engin, engin jusqu'a la station de montee, ligne(s), derniers metres a
// pied. Seul change ce qui tient a l'engin : ou le prendre, ou l'on a le droit
// de le laisser, combien de temps il coute a deverrouiller. Le generateur porte
// l'enchainement, chaque mode ne decrit que sa difference.
import type { GeoPoint, MobilityMode, RouteLeg, RouteOption, RouteRequest, SharedStation } from '../../../types';
import { haversineDistanceKm, nearestStation, stationToPoint, stopToPoint } from '../geo';
import { MODE_LABELS } from '../labels';
import { buildOption, createLeg } from '../legs';
import { findTransitJourney, transitLegs } from '../transit';

export interface Feeder {
  id: 'bike-transit' | 'scooter-transit';
  mode: Extract<MobilityMode, 'bike' | 'scooter'>;
  title: string;
  /** Une station ou un engin est effectivement a louer. */
  available(station: SharedStation): boolean;
  /**
   * L'engin doit pouvoir etre laisse a la station de montee : sur une borne
   * pour le Velo'v, dans la zone de service pour une flotte libre (B17).
   */
  canDropOff(stations: SharedStation[], point: GeoPoint): boolean;
  detail(station: SharedStation): string;
  /** Temps fixe de prise en main : deverrouillage, sortie de borne. */
  unlockMinutes: number;
  /** Fiabilite par temps sec, puis sous la pluie ou avec une ligne en retard. */
  reliability: { clear: number; degraded: number };
}

export function createFeederTransitOption(
  { origin, destination, profile, network }: RouteRequest,
  directKm: number,
  feeder: Feeder,
): RouteOption | null {
  const stations = network.sharedMobility.data.stations;
  const vehicle = MODE_LABELS[feeder.mode];
  const Vehicle = vehicle.charAt(0).toUpperCase() + vehicle.slice(1);
  const fromStation = nearestStation(stations.filter(feeder.available), origin);
  if (!fromStation) {
    return null;
  }

  // L'engin sert de rabattement : la recherche de trajet part donc de la
  // station, pas du domicile. Sans cela, la station de montee choisie serait
  // celle du depart a pied, que l'engin aurait deja depassee.
  const journey = findTransitJourney(network, stationToPoint(fromStation), destination, profile.accessibilityNeed);
  if (!journey) {
    return null;
  }

  const boarding = journey.rides[0].boarding;
  const alighting = journey.rides[journey.rides.length - 1].alighting;
  if (!feeder.canDropOff(stations, stopToPoint(boarding))) {
    return null;
  }

  const firstWalkKm = haversineDistanceKm(origin, stationToPoint(fromStation));
  // Estimation de tri seulement, remplacee par la mesure de la voirie avant
  // affichage : un plancher evite qu'un rabattement quasi nul ne classe
  // l'option devant le transport seul.
  const feederKm = Math.max(haversineDistanceKm(stationToPoint(fromStation), stopToPoint(boarding)) * 1.2, directKm * 0.22);
  const finalWalkKm = haversineDistanceKm(stopToPoint(alighting), destination);
  const rainWarning = network.gtfs.weather.condition.includes('rain');
  const delayed = journey.rides.some((ride) => ride.waitMinutes > 4);

  const legs: RouteLeg[] = [
    createLeg({
      id: `${feeder.id}-walk-to-${feeder.mode}`,
      mode: 'walk',
      title: `Approche ${vehicle}`,
      from: origin,
      to: stationToPoint(fromStation),
      distanceKm: firstWalkKm,
      accessible: true,
    }),
    {
      ...createLeg({
        id: `${feeder.id}-feeder`,
        mode: feeder.mode,
        title: `${Vehicle} vers correspondance`,
        from: stationToPoint(fromStation),
        to: stopToPoint(boarding),
        distanceKm: feederKm,
        accessible: !profile.accessibilityNeed,
        estimate: { overheadMinutes: feeder.unlockMinutes },
      }),
      detail: feeder.detail(fromStation),
    },
    ...transitLegs(journey, feeder.id),
    createLeg({
      id: `${feeder.id}-walk-from-transit`,
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
    id: feeder.id,
    title: feeder.title,
    summary: `${Vehicle} jusqu'a ${boarding.stop_name}, puis ligne ${lines}.`,
    modes: ['walk', feeder.mode, 'transit'],
    legs,
    reliabilityScore: delayed || rainWarning ? feeder.reliability.degraded : feeder.reliability.clear,
    // RG4 : l'engin est a l'air libre, la pluie s'applique a la portion de rabattement.
    warnings: rainWarning && profile.avoidRain ? [`Pluie legere detectee sur la portion ${vehicle}.`] : [],
  });
}
