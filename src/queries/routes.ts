// Le serveur classe tous les trajets autorisés sur le réseau complet ; la zone
// affichée sur la carte ne limite jamais la recherche.
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

export function routeOptionsQuery(search: RouteSearch | null, network: TransportContext) {
    const body = search ? {
        origin: search.origin,
        destination: search.destination,
        modes: requestedModes(search.filters, network),
        transitTypes: search.filters.transitTypes,
        accessibilityNeed: search.accessibilityNeed,
    } : null;
    return queryOptions({
        queryKey: body ? [...queryKeys.routeOptions(body), network.version] : ['route-options', null],
        queryFn: body ? ({ signal }) => treatyRequest(api.transport.journeys.post(
            body,
            { fetch: { signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) } },
        )) : skipToken,
        staleTime: 5 * 60_000,
    });
}
