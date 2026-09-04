// Mesure des options d'itineraire par le service de routage.
//
// Le moteur local (lib/planner) dit quelles options existent ; ses chiffres ne
// sortent pas du calcul. La mesure, elle, est une requete : elle s'annule
// d'elle-meme quand les extremites changent, et se garde le temps qu'un
// utilisateur compare deux recherches.
import { queryOptions, skipToken } from '@tanstack/react-query';
import type { GeoPoint, MobilityProfile, RouteOption } from '../types';
import { measureRoutes } from '../lib/planner';
import { enhanceLegsWithLiveRouting } from '../lib/transport';
import { queryKeys } from './keys';

export interface RouteSearch {
  origin: GeoPoint;
  destination: GeoPoint;
  profile: MobilityProfile;
}

export function measuredRoutesQuery(search: RouteSearch | null, localRoutes: RouteOption[]) {
  return queryOptions({
    queryKey: search ? queryKeys.measuredRoutes(search.origin, search.destination, search.profile) : ['measured-routes', null],
    queryFn:
      search && localRoutes.length > 0
        ? ({ signal }) => measureRoutes(localRoutes, search.profile, (legs) => enhanceLegsWithLiveRouting(legs, signal))
        : skipToken,
    // Le serveur cache les traces 24 h : remesurer au retour sur l'onglet
    // n'apporterait rien.
    staleTime: 5 * 60_000,
  });
}
