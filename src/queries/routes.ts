// Mesure des options d'itineraire par le service de routage.
//
// Le moteur local (lib/planner) assemble les options a partir des acces choisis
// par duree OSRM. La meme requete mesure ensuite chaque segment : elle s'annule
// d'elle-meme quand les extremites changent, et se garde le temps qu'un
// utilisateur compare deux recherches.
import { queryOptions, skipToken } from '@tanstack/react-query';
import type { GeoPoint, MobilityProfile, TransportNetwork } from '../types';
import {
    applyCarbonReference,
    createCarbonReference,
    measureRoutes,
    planRoutes,
    prepareRoutedAccessPlan,
} from '../lib/planner';
import { enhanceLegsWithLiveRouting, fetchRouteMatrix } from '../lib/transport';
import { queryKeys } from './keys';

export interface RouteSearch {
    origin: GeoPoint;
    destination: GeoPoint;
    profile: MobilityProfile;
}

export function measuredRoutesQuery(search: RouteSearch | null, network: TransportNetwork) {
    return queryOptions({
        queryKey: search ? queryKeys.measuredRoutes(search.origin, search.destination, search.profile) : ['measured-routes', null],
        queryFn:
            search
                ? async ({ signal }) => {
                    // La voiture n'est jamais une option. Sa matrice 1 x 1 demarre en
                    // meme temps que le choix des acces et fournit une reference
                    // commune, quelle que soit la longueur propre de chaque option.
                    const carReferencePromise = fetchRouteMatrix(
                        'car',
                        [search.origin],
                        [search.destination],
                        signal,
                    ).then((matrix) => createCarbonReference(matrix?.[0]?.[0] ?? null));
                    const accessPromise = prepareRoutedAccessPlan(
                        {
                            origin: search.origin,
                            destination: search.destination,
                            network,
                            requireAccessible: search.profile.accessibilityNeed,
                        },
                        (mode, origins, destinations) => fetchRouteMatrix(mode, origins, destinations, signal),
                    );
                    const access = await accessPromise;
                    const routes = planRoutes({ ...search, network }, access);
                    const [measured, carReference] = await Promise.all([
                        measureRoutes(routes, search.profile, (legs) => enhanceLegsWithLiveRouting(legs, signal)),
                        carReferencePromise,
                    ]);
                    return applyCarbonReference(measured, carReference);
                }
                : skipToken,
        // Le serveur cache les traces 24 h : remesurer au retour sur l'onglet
        // n'apporterait rien.
        staleTime: 5 * 60_000,
    });
}
