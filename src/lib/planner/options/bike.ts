// Generateur d'option : bike.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { SPEED_KMH } from '../constants';
import { haversineDistanceKm, midpoint, nearestStation, stationToPoint } from '../geo';
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
    createLeg('walk-to-bike', 'walk', 'Rejoindre une station velo', origin.label, fromStation.name, firstWalkKm, true, [
      origin,
      stationToPoint(fromStation),
    ]),
    {
      ...createLeg('bike-core', 'bike', 'Velo partage', fromStation.name, toStation.name, bikeKm, !profile.accessibilityNeed, [
        stationToPoint(fromStation),
        midpoint(stationToPoint(fromStation), stationToPoint(toStation), -0.008),
        stationToPoint(toStation),
      ]),
      durationMinutes: minutesForDistance(bikeKm, SPEED_KMH.bike) + 2,
      detail: `${fromStation.bikes_available} velos disponibles au depart, retour autorise a destination.`,
    },
    createLeg('walk-from-bike', 'walk', 'Fin de trajet', toStation.name, destination.label, lastWalkKm, true, [
      stationToPoint(toStation),
      destination,
    ]),
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
