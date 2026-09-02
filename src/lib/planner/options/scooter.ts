// Generateur d'option : scooter.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { haversineDistanceKm, nearestStation, stationToPoint, withinServiceArea } from '../geo';
import { buildOption, createLeg } from '../legs';

export function createScooterOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption | null {
  // La disponibilite au depart ne suffit pas : sans borne a l'arrivee, une
  // trottinette libre a 200 m suffisait a proposer n'importe quelle distance,
  // Lyon-Paris compris (B17).
  if (!withinServiceArea(destination)) {
    return null;
  }

  const station = nearestStation(
    network.sharedMobility.data.stations.filter((item) => item.is_renting && item.scooters_available > 0),
    origin,
  );

  if (!station) {
    return null;
  }

  const legs: RouteLeg[] = [
    createLeg({
      id: 'walk-to-scooter',
      mode: 'walk',
      title: 'Rejoindre une trottinette',
      from: origin,
      to: stationToPoint(station),
      distanceKm: haversineDistanceKm(origin, stationToPoint(station)),
      accessible: true,
    }),
    {
      ...createLeg({
        id: 'scooter-core',
        mode: 'scooter',
        title: 'Trottinette partagee',
        from: stationToPoint(station),
        to: destination,
        distanceKm: directKm * 1.06,
        accessible: !profile.accessibilityNeed,
        // Deverrouillage par l'application.
        estimate: { overheadMinutes: 1 },
      }),
      detail: `${station.scooters_available} trottinettes disponibles au depart.`,
    },
  ];

  return buildOption({
    id: 'scooter',
    title: 'Trottinette',
    summary: 'Trajet direct en trottinette partagee selon disponibilite.',
    modes: ['walk', 'scooter'],
    legs,
    reliabilityScore: 80,
    warnings: [],
  });
}
