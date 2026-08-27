// Generateur d'option : scooter.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { SPEED_KMH } from '../constants';
import { haversineDistanceKm, midpoint, nearestStation, stationToPoint } from '../geo';
import { buildOption, createLeg } from '../legs';
import { minutesForDistance } from '../metrics';

export function createScooterOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption | null {
  const station = nearestStation(
    network.sharedMobility.data.stations.filter((item) => item.is_renting && item.scooters_available > 0),
    origin,
  );

  if (!station) {
    return null;
  }

  const legs: RouteLeg[] = [
    createLeg(
      'walk-to-scooter',
      'walk',
      'Rejoindre une trottinette',
      origin.label,
      station.name,
      haversineDistanceKm(origin, stationToPoint(station)),
      true,
      [origin, stationToPoint(station)],
    ),
    {
      ...createLeg(
        'scooter-core',
        'scooter',
        'Trottinette partagee',
        station.name,
        destination.label,
        directKm * 1.06,
        !profile.accessibilityNeed,
        [stationToPoint(station), midpoint(stationToPoint(station), destination, 0.006), destination],
      ),
      durationMinutes: minutesForDistance(directKm * 1.06, SPEED_KMH.scooter) + 1,
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
