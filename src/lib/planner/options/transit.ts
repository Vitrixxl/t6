// Generateur d'option : transit.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { SPEED_KMH } from '../constants';
import { haversineDistanceKm, midpoint, nearestStop, stopToPoint } from '../geo';
import { routeLabel } from '../labels';
import { buildOption, createLeg } from '../legs';
import { minutesForDistance } from '../metrics';

export function createTransitOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption | null {
  const fromStop = nearestStop(network.gtfs.stops, origin, profile.accessibilityNeed);
  const toStop = nearestStop(network.gtfs.stops, destination, profile.accessibilityNeed);
  if (!fromStop || !toStop) {
    // Profil PMR sans arret accessible a proximite: pas d'option transport public conforme.
    return null;
  }
  const trip = network.gtfs.trips.slice().sort((a, b) => a.headway_minutes - b.headway_minutes)[0];
  const route = network.gtfs.routes.find((item) => item.route_id === trip.route_id) ?? network.gtfs.routes[0];
  const firstWalkKm = haversineDistanceKm(origin, stopToPoint(fromStop));
  const transitKm = Math.max(haversineDistanceKm(stopToPoint(fromStop), stopToPoint(toStop)) * 1.15, directKm * 0.7);
  const lastWalkKm = haversineDistanceKm(stopToPoint(toStop), destination);
  const waitMinutes = Math.ceil(trip.headway_minutes / 2 + trip.realtime_delay_minutes);
  const trafficWarning = network.gtfs.incidents.find((incident) => incident.affected_modes.includes('transit'));
  const legs: RouteLeg[] = [
    createLeg('walk-to-stop', 'walk', 'Approche pietonne', origin.label, fromStop.stop_name, firstWalkKm, true, [
      origin,
      stopToPoint(fromStop),
    ]),
    {
      ...createLeg(
        'transit-core',
        'transit',
        `${routeLabel(route)} vers ${toStop.stop_name}`,
        fromStop.stop_name,
        toStop.stop_name,
        transitKm,
        fromStop.wheelchair_boarding === 1 && toStop.wheelchair_boarding === 1,
        [stopToPoint(fromStop), midpoint(stopToPoint(fromStop), stopToPoint(toStop), 0.012), stopToPoint(toStop)],
      ),
      mapLabel: routeLabel(route),
      durationMinutes: minutesForDistance(transitKm, SPEED_KMH.transit) + waitMinutes,
      detail: `Attente estimee ${waitMinutes} min, occupation ${trip.occupancy}.`,
    },
    createLeg('walk-from-stop', 'walk', 'Derniers metres', toStop.stop_name, destination.label, lastWalkKm, true, [
      stopToPoint(toStop),
      destination,
    ]),
  ];

  return buildOption({
    id: 'transit',
    title: 'Transport en commun',
    summary: 'Marche courte puis transport en commun avec delais temps reel.',
    modes: ['walk', 'transit'],
    legs,
    reliabilityScore: trip.realtime_delay_minutes > 2 ? 74 : 88,
    warnings: trafficWarning ? [trafficWarning.message] : [],
  });
}
