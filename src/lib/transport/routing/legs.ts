// Geometrie reelle segment par segment.
//
// L'enrichissement d'une option (routing/index.ts) calcule un seul trace
// origine -> destination : suffisant pour dessiner une ligne unique, mais
// inutilisable des lors qu'on veut colorer chaque segment selon son mode. Le
// trace ne passait d'ailleurs pas par les arrets listes dans les segments.
//
// Ici, chaque segment est route avec le profil qui lui correspond : le segment
// pieton suit les trottoirs, le segment velo les pistes cyclables. Le cout est
// borne — on n'enrichit que l'itineraire selectionne, soit trois a quatre
// appels, et seulement quand la selection change.
import type { RouteLeg } from '../../../types';
import { fetchRouteGeometry } from './osrm';

export async function enhanceLegsWithLiveRouting(legs: RouteLeg[], signal?: AbortSignal): Promise<RouteLeg[]> {
  return Promise.all(
    legs.map(async (leg) => {
      const from = leg.path[0];
      const to = leg.path[leg.path.length - 1];
      if (!from || !to) {
        return leg;
      }

      const geometry = await fetchRouteGeometry(leg.mode, from, to, signal);
      // Repli assume : sans reponse, on garde la geometrie approchee. Le
      // segment reste affiche, seulement moins precis (C10).
      if (!geometry || geometry.path.length < 2) {
        return leg;
      }

      return { ...leg, path: geometry.path };
    }),
  );
}
