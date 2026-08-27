// Generateur d'option : carpool.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { SPEED_KMH } from '../constants';
import { midpoint } from '../geo';
import { buildOption, createLeg } from '../legs';
import { minutesForDistance } from '../metrics';

export function createCarpoolOption({ origin, destination, network }: RouteRequest, directKm: number): RouteOption {
  const incident = network.gtfs.incidents.find((item) => item.affected_modes.includes('carpool'));
  const trafficFactor = incident ? 1.18 : 1.08;
  const legs: RouteLeg[] = [
    {
      ...createLeg('carpool-core', 'carpool', 'Covoiturage', origin.label, destination.label, directKm * trafficFactor, true, [
        origin,
        midpoint(origin, destination, 0.018),
        destination,
      ]),
      durationMinutes: minutesForDistance(directKm * trafficFactor, SPEED_KMH.carpool) + 6,
      detail: 'Matching simule avec conducteur compatible et attente moyenne de 6 min.',
    },
  ];

  return buildOption({
    id: 'carpool',
    title: 'Covoiturage',
    summary: 'Alternative mutualisee si les modes doux sont moins adaptes.',
    modes: ['carpool'],
    legs,
    reliabilityScore: incident ? 68 : 78,
    warnings: incident ? [incident.message] : [],
  });
}
