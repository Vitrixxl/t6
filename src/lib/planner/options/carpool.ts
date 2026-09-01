// Generateur d'option : carpool.
//
// Le covoiturage n'est pas un service ici : aucun conducteur n'est mis en
// relation, aucune offre n'est consultee. C'est un point de comparaison, pour
// que l'utilisateur voie ce que couterait en CO2 le meme trajet en voiture
// partagee. Le dossier place le covoiturage dynamique hors perimetre (2.3) ;
// l'interface ne doit rien annoncer de plus.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { SPEED_KMH } from '../constants';
import { buildOption, createLeg } from '../legs';
import { minutesForDistance } from '../metrics';

export function createCarpoolOption({ origin, destination, network }: RouteRequest, directKm: number): RouteOption {
  const incident = network.gtfs.incidents.find((item) => item.affected_modes.includes('carpool'));
  const trafficFactor = incident ? 1.18 : 1.08;
  const legs: RouteLeg[] = [
    {
      ...createLeg({
        id: 'carpool-core',
        mode: 'carpool',
        title: 'Covoiturage',
        from: origin,
        to: destination,
        distanceKm: directKm * trafficFactor,
        accessible: true,
      }),
      durationMinutes: minutesForDistance(directKm * trafficFactor, SPEED_KMH.carpool) + 6,
      detail: "Estimation d'un trajet en voiture partagee, avec 6 min de prise en charge. Aucun conducteur n'est mis en relation.",
    },
  ];

  return buildOption({
    id: 'carpool',
    title: 'Covoiturage',
    summary: 'Point de comparaison en voiture partagee, sans mise en relation.',
    modes: ['carpool'],
    legs,
    reliabilityScore: incident ? 68 : 78,
    warnings: incident ? [incident.message] : [],
  });
}
