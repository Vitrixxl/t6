// Generateur d'option : bike + transit.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { SPEED_KMH } from '../constants';
import { haversineDistanceKm, midpoint, nearestStation, nearestStop, stationToPoint, stopToPoint } from '../geo';
import { routeLabel } from '../labels';
import { buildOption, createLeg } from '../legs';
import { minutesForDistance } from '../metrics';

export function createBikeTransitOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption | null {
  const stations = network.sharedMobility.data.stations.filter(
    (station) => station.is_installed && station.is_renting && station.is_returning && station.bikes_available > 0,
  );
  const fromStation = nearestStation(stations, origin);

  if (!fromStation) {
    return null;
  }

  const boardingStop = nearestStop(network.gtfs.stops, stationToPoint(fromStation), profile.accessibilityNeed);
  const arrivalStop = nearestStop(network.gtfs.stops, destination, profile.accessibilityNeed);
  if (!boardingStop || !arrivalStop) {
    return null;
  }
  const trip = network.gtfs.trips.slice().sort((a, b) => a.headway_minutes - b.headway_minutes)[0];
  const route = network.gtfs.routes.find((item) => item.route_id === trip.route_id) ?? network.gtfs.routes[0];
  const firstWalkKm = haversineDistanceKm(origin, stationToPoint(fromStation));
  const bikeKm = Math.max(haversineDistanceKm(stationToPoint(fromStation), stopToPoint(boardingStop)) * 1.2, directKm * 0.22);
  const transitKm = Math.max(haversineDistanceKm(stopToPoint(boardingStop), stopToPoint(arrivalStop)) * 1.12, directKm * 0.5);
  const finalWalkKm = haversineDistanceKm(stopToPoint(arrivalStop), destination);
  const waitMinutes = Math.ceil(trip.headway_minutes / 2 + trip.realtime_delay_minutes);
  const trafficWarning = network.gtfs.incidents.find((incident) => incident.affected_modes.includes('transit'));
  const rainWarning = network.gtfs.weather.condition.includes('rain');
  const legs: RouteLeg[] = [
    createLeg('hybrid-walk-to-bike', 'walk', 'Approche velo', origin.label, fromStation.name, firstWalkKm, true, [
      origin,
      stationToPoint(fromStation),
    ]),
    {
      ...createLeg(
        'hybrid-bike-to-transit',
        'bike',
        'Velo vers correspondance',
        fromStation.name,
        boardingStop.stop_name,
        bikeKm,
        !profile.accessibilityNeed,
        [stationToPoint(fromStation), midpoint(stationToPoint(fromStation), stopToPoint(boardingStop), -0.006), stopToPoint(boardingStop)],
      ),
      durationMinutes: minutesForDistance(bikeKm, SPEED_KMH.bike) + 2,
      detail: `${fromStation.bikes_available} velos disponibles pour rejoindre la correspondance.`,
    },
    {
      ...createLeg(
        'hybrid-transit-core',
        'transit',
        `${routeLabel(route)} vers ${arrivalStop.stop_name}`,
        boardingStop.stop_name,
        arrivalStop.stop_name,
        transitKm,
        boardingStop.wheelchair_boarding === 1 && arrivalStop.wheelchair_boarding === 1,
        [stopToPoint(boardingStop), midpoint(stopToPoint(boardingStop), stopToPoint(arrivalStop), 0.01), stopToPoint(arrivalStop)],
      ),
      durationMinutes: minutesForDistance(transitKm, SPEED_KMH.transit) + waitMinutes,
      detail: `Correspondance estimee ${waitMinutes} min, occupation ${trip.occupancy}.`,
    },
    createLeg('hybrid-walk-from-transit', 'walk', 'Derniers metres', arrivalStop.stop_name, destination.label, finalWalkKm, true, [
      stopToPoint(arrivalStop),
      destination,
    ]),
  ];

  return buildOption({
    id: 'bike-transit',
    title: 'Velo + transport en commun',
    summary: 'Velo partage puis transport en commun avec correspondance a un arret proche.',
    modes: ['walk', 'bike', 'transit'],
    legs,
    reliabilityScore: trip.realtime_delay_minutes > 2 || rainWarning ? 78 : 90,
    warnings: [
      ...(trafficWarning ? [trafficWarning.message] : []),
      ...(rainWarning && profile.avoidRain ? ['Pluie legere detectee sur la portion velo.'] : []),
    ],
  });
}
