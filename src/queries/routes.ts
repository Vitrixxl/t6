// Le serveur calcule le trajet le plus rapide sur le réseau complet ; le
// navigateur ne reçoit que ses mesures et son tracé, indépendamment de la zone affichée.
import { queryOptions, skipToken } from '@tanstack/react-query';
import type { AvailableMode, GeoPoint, TransportContext } from '../types';
import { api, treatyRequest } from '../lib/api/client';
import type { SearchFilters } from '../lib/planner/search-filters';
import { queryKeys } from './keys';

export interface RouteSearch {
    origin: GeoPoint;
    destination: GeoPoint;
    filters: SearchFilters;
    accessibilityNeed: boolean;
}

/** Sans flux GBFS, aucun engin partagé n'est demandé : le moteur ne propose que ce qui se prend vraiment. */
function requestedModes(filters: SearchFilters, network: TransportContext): AvailableMode[] {
    return filters.modes.filter(mode => mode === 'transit' ? network.transitRoutingAvailable : network.sharedMobility !== null);
}

export function fastestRouteQuery(search: RouteSearch | null, network: TransportContext) {
    const body = search ? {
        origin: search.origin,
        destination: search.destination,
        modes: requestedModes(search.filters, network),
        transitTypes: search.filters.transitTypes,
        accessibilityNeed: search.accessibilityNeed,
    } : null;
    return queryOptions({
        queryKey: body ? [...queryKeys.fastestRoute(body), network.version] : ['fastest-route', null],
        queryFn: body ? ({ signal }) => treatyRequest(api.transport.journeys.post(
            body,
            { fetch: { signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) } },
        )) : skipToken,
        staleTime: 5 * 60_000,
    });
}
