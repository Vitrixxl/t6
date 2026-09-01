// Generateur d'option : bike.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { SPEED_KMH } from '../constants';
import { haversineDistanceKm, nearestStation, stationToPoint } from '../geo';
import { buildOption, createLeg } from '../legs';
import { minutesForDistance } from '../metrics';

export function createBikeOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption | null {
  const stations = network.sharedMobility.data.stations.filter(
    (station) => station.is_installed && station.is_renting && station.is_returning && station.bikes_available > 0,
  );
  const fromStation = nearestStation(stations, origin);
  const toStation = nearestStation(stations, destination);

  if (!fromStation || !toStation) {
    return null;
  }

  const rainWarning = network.gtfs.weather.condition.includes('rain');
  const firstWalkKm = haversineDistanceKm(origin, stationToPoint(fromStation));
  const bikeKm = Math.max(haversineDistanceKm(stationToPoint(fromStation), stationToPoint(toStation)) * 1.1, directKm);
  const lastWalkKm = haversineDistanceKm(stationToPoint(toStation), destination);
  const legs: RouteLeg[] = [
    createLeg({
      id: 'walk-to-bike',
      mode: 'walk',
      title: 'Rejoindre une station velo',
      from: origin,
      to: stationToPoint(fromStation),
      distanceKm: firstWalkKm,
      accessible: true,
    }),
    {
      ...createLeg({
        id: 'bike-core',
        mode: 'bike',
        title: 'Velo partage',
        from: stationToPoint(fromStation),
        to: stationToPoint(toStation),
        distanceKm: bikeKm,
        accessible: !profile.accessibilityNeed,
      }),
      durationMinutes: minutesForDistance(bikeKm, SPEED_KMH.bike) + 2,
      detail: `${fromStation.bikes_available} velos disponibles au depart, retour autorise a destination.`,
    },
    createLeg({
      id: 'walk-from-bike',
      mode: 'walk',
      title: 'Fin de trajet',
      from: stationToPoint(toStation),
      to: destination,
      distanceKm: lastWalkKm,
      accessible: true,
    }),
  ];

  return buildOption({
    id: 'bike',
    title: 'Velo',
    summary: 'Velo partage selon les disponibilites des stations proches.',
    modes: ['walk', 'bike'],
    legs,
    reliabilityScore: rainWarning ? 71 : 86,
    warnings: rainWarning && profile.avoidRain ? ['Pluie legere detectee, confort degrade pour le velo.'] : [],
  });
}
