// Geometrie reelle segment par segment.
//
// Chaque segment est route avec le profil qui lui correspond : le segment
// pieton suit les trottoirs, le segment velo les pistes cyclables. Le cout est
// borne — on n'enrichit que l'itineraire selectionne, soit trois a quatre
// appels, et seulement quand la selection change.
//
// Un segment dont le routage ne repond pas ressort **sans geometrie**. C'est
// deliberé : l'interface affichera un calcul en cours ou une indisponibilite,
// jamais une ligne inventee. Un trace faux se lit comme un itineraire reel et
// envoie l'utilisateur ailleurs (B14).
import type { RouteLeg } from '../../../types';
import { fetchRouteGeometry } from './osrm';

export async function enhanceLegsWithLiveRouting(legs: RouteLeg[], signal?: AbortSignal): Promise<RouteLeg[]> {
  return Promise.all(
    legs.map(async (leg) => {
      // Un segment de transport public porte deja le trace reel de la ligne,
      // decoupe entre les deux stations. OSRM ne route pas le rail : le lui
      // demander renvoyait un itineraire *routier* entre les deux stations, ce
      // qui dessinait le metro sur les quais et les sens uniques (B12).
      if (leg.mode === 'transit') {
        return leg;
      }

      const geometry = await fetchRouteGeometry(leg.mode, leg.fromPoint, leg.toPoint, signal);
      if (!geometry || geometry.path.length < 2) {
        return { ...leg, path: [] };
      }

      return { ...leg, path: geometry.path };
    }),
  );
}

/** Un itineraire est pret a etre dessine quand tous ses segments ont un trace. */
export function hasCompleteGeometry(legs: RouteLeg[]): boolean {
  return legs.length > 0 && legs.every((leg) => leg.path.length >= 2);
}
