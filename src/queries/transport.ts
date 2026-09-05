// Le contexte léger ne contient ni quais TCL ni tracés : ils ont leurs ressources.
import { queryOptions, useQuery } from '@tanstack/react-query';
import { api, treatyRequest } from '../lib/api/client';
import { queryKeys } from './keys';

export const transportContextQuery = queryOptions({
    queryKey: queryKeys.transportContext,
    queryFn: ({ signal }) => treatyRequest(api.transport.context.get({ fetch: { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) } })),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
});

export function useTransportContext(enabled: boolean) {
    return useQuery({ ...transportContextQuery, enabled });
}
