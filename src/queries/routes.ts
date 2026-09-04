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

async function loadMeasuredRoutes(search: RouteSearch, network: TransportNetwork, signal: AbortSignal) {
    // La voiture reste une reference invisible. Sa mesure demarre en parallele
    // du choix des stations et sera appliquee a toutes les options.
    const carReferencePromise = fetchRouteMatrix(
        'car',
        [search.origin],
        [search.destination],
        signal,
    ).then((matrix) => createCarbonReference(matrix?.[0]?.[0] ?? null));

    const access = await prepareRoutedAccessPlan(
        {
            origin: search.origin,
            destination: search.destination,
            network,
            requireAccessible: search.profile.accessibilityNeed,
        },
        (mode, origins, destinations) => fetchRouteMatrix(mode, origins, destinations, signal),
    );

    const options = planRoutes({ ...search, network }, access);
    const measuredOptions = await measureRoutes(
        options,
        search.profile,
        (legs) => enhanceLegsWithLiveRouting(legs, signal),
    );
    const carReference = await carReferencePromise;
    return applyCarbonReference(measuredOptions, carReference);
}

export function measuredRoutesQuery(search: RouteSearch | null, network: TransportNetwork) {
    return queryOptions({
        queryKey: search ? queryKeys.measuredRoutes(search.origin, search.destination, search.profile) : ['measured-routes', null],
        queryFn: search ? ({ signal }) => loadMeasuredRoutes(search, network, signal) : skipToken,
        // Le serveur cache les traces 24 h : remesurer au retour sur l'onglet
        // n'apporterait rien.
        staleTime: 5 * 60_000,
    });
}
