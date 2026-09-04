// Le réseau de transport (GTFS, stations partagées, météo) : charge une fois
// par session, il ne change pas sous les pieds du moteur d'itinéraires.
import { queryOptions, useQuery } from '@tanstack/react-query';
import { loadTransportNetwork } from '../lib/transport';
import { queryKeys } from './keys';

export const transportNetworkQuery = queryOptions({
    queryKey: queryKeys.transportNetwork,
    queryFn: () => loadTransportNetwork(),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
});

export function useTransportNetwork() {
    return useQuery(transportNetworkQuery);
}
