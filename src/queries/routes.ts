// Le serveur calcule toutes les options avec le réseau complet ; le navigateur
// ne reçoit que leurs mesures et tracés, indépendamment de la zone affichée.
import { queryOptions, skipToken } from '@tanstack/react-query';
import type { GeoPoint, MobilityProfile, TransportContext } from '../types';
import { api, treatyRequest } from '../lib/api/client';
import { queryKeys } from './keys';
import { ALL_TRANSIT_TYPES, type TransitType } from '../lib/planner/transit-filter';

export interface RouteSearch {
    origin: GeoPoint;
    destination: GeoPoint;
    profile: MobilityProfile;
    transitTypes?: readonly TransitType[];
}

export function measuredRoutesQuery(search: RouteSearch | null, network: TransportContext) {
    return queryOptions({
        queryKey: [...(search ? queryKeys.measuredRoutes(search.origin, search.destination, search.profile, search.transitTypes) : ['measured-routes', null]), network.version, Boolean(network.sharedMobility)],
        queryFn: search ? ({ signal }) => treatyRequest(api.transport.journeys.post({
            ...search,
            transitTypes: [...(search.transitTypes ?? ALL_TRANSIT_TYPES)],
            sharedMobilityAvailable: network.sharedMobility !== null,
        }, { fetch: { signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]) } })) : skipToken,
        staleTime: 5 * 60_000,
    });
}
