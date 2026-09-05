// Mesure des options d'itinéraire par le service de routage.
//
// Le moteur local (lib/planner) assemble les options à partir des accès choisis
// par durée OSRM. La même requête mesure ensuite chaque segment : elle s'annule
// d'elle-même quand les extrémités changent, et se garde le temps qu'un
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
import { ALL_TRANSIT_TYPES, filterTransitNetwork, type TransitType } from '../lib/planner/transit-filter';

export interface RouteSearch {
    origin: GeoPoint;
    destination: GeoPoint;
    profile: MobilityProfile;
    transitTypes?: readonly TransitType[];
}

async function loadMeasuredRoutes(search: RouteSearch, network: TransportNetwork, signal: AbortSignal) {
    // La voiture reste une référence invisible. Sa mesure demarre en parallèle
    // du choix des stations et sera appliquée à toutes les options.
    const carReferencePromise = fetchRouteMatrix(
        'car',
        [search.origin],
        [search.destination],
        signal,
    ).then((matrix) => createCarbonReference(matrix?.[0]?.[0] ?? null));

    const availableNetwork = filterTransitNetwork(network, search.transitTypes ?? ALL_TRANSIT_TYPES);
    const access = await prepareRoutedAccessPlan(
        {
            origin: search.origin,
            destination: search.destination,
            network: availableNetwork,
            requireAccessible: search.profile.accessibilityNeed,
        },
        (mode, origins, destinations) => fetchRouteMatrix(mode, origins, destinations, signal),
    );

    const options = planRoutes({ ...search, network: availableNetwork }, access);
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
        queryKey: search ? queryKeys.measuredRoutes(search.origin, search.destination, search.profile, search.transitTypes) : ['measured-routes', null],
        queryFn: search ? ({ signal }) => loadMeasuredRoutes(search, network, signal) : skipToken,
        // Le serveur cache les tracés 24 h : remesurer au retour sur l'onglet
        // n'apporterait rien.
        staleTime: 5 * 60_000,
    });
}
