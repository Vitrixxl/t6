// Generateur d'option : carpool.
//
// Le covoiturage n'est pas un service ici : aucun conducteur n'est mis en
// relation, aucune offre n'est consultee. C'est un point de comparaison, pour
// que l'utilisateur voie ce que couterait en CO2 le meme trajet en voiture
// partagee. Le dossier place le covoiturage dynamique hors perimetre (2.3) ;
// l'interface ne doit rien annoncer de plus.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { DEFAULT_CARPOOL_OCCUPANTS, EMISSIONS_G_PER_KM } from '../constants';
import { buildOption, createLeg } from '../legs';

/** Minutes forfaitaires de prise en charge : detour du conducteur et rendez-vous. */
const PICKUP_MINUTES = 6;

export function carpoolCarbonPerKm(occupants: number): number {
  // Le vehicule emet autant quel que soit son remplissage : la part de chaque
  // passager est donc l'emission du vehicule divisee par le nombre de personnes
  // a bord. C'est la convention ADEME. Simplification assumee : un vehicule
  // plus charge consomme legerement plus, ce que ce modele ignore, et qui
  // surestime l'economie de quelques pour cent.
  return EMISSIONS_G_PER_KM.carpool / Math.max(occupants, 1);
}

export function createCarpoolOption({ origin, destination, profile, network }: RouteRequest, directKm: number): RouteOption {
  const incident = network.gtfs.incidents.find((item) => item.affected_modes.includes('carpool'));
  // Le calculateur d'itineraires raisonne en circulation fluide. Ce facteur est
  // l'hypothese de congestion, plus forte quand un incident est signale.
  const congestionFactor = incident ? 1.18 : 1.08;
  const occupants = profile.carpoolOccupants ?? DEFAULT_CARPOOL_OCCUPANTS;
  const legs: RouteLeg[] = [
    {
      ...createLeg({
        id: 'carpool-core',
        mode: 'carpool',
        title: 'Covoiturage',
        from: origin,
        to: destination,
        distanceKm: directKm,
        accessible: true,
        estimate: {
          travelFactor: congestionFactor,
          overheadMinutes: PICKUP_MINUTES,
          carbonGramsPerKm: carpoolCarbonPerKm(occupants),
        },
      }),
      detail: `Trajet en voiture partagee a ${occupants} personne${occupants > 1 ? 's' : ''}, avec ${PICKUP_MINUTES} min de prise en charge. Aucun conducteur n'est mis en relation.`,
    },
  ];

  return buildOption({
    id: 'carpool',
    title: 'Covoiturage',
    summary: `Voiture partagee a ${occupants} personne${occupants > 1 ? 's' : ''} : point de comparaison, sans mise en relation.`,
    modes: ['carpool'],
    legs,
    reliabilityScore: incident ? 68 : 78,
    warnings: incident ? [incident.message] : [],
  });
}
