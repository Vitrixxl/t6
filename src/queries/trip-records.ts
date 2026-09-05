// Historique carbone : lecture et effacement explicite de la collection.
// Les lignes individuelles sont créées automatiquement après la date prévue d’un trajet non annulé.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { TripRecord } from '../types';
import { clearTripHistory, fetchTripRecords } from '../lib/api/trip-history';
import { mutationKeys, queryKeys } from './keys';
import { readSession } from './session';

const EMPTY_TRIP_RECORDS: TripRecord[] = [];

export function readTripRecords(client: QueryClient): TripRecord[] {
    return client.getQueryData<TripRecord[]>(queryKeys.tripRecords)
        ?? readSession(client)?.state.tripRecords
        ?? EMPTY_TRIP_RECORDS;
}

export function tripRecordsQuery(client: QueryClient) {
    return queryOptions({
        queryKey: queryKeys.tripRecords,
        queryFn: fetchTripRecords,
        initialData: () => readSession(client)?.state.tripRecords ?? EMPTY_TRIP_RECORDS,
        initialDataUpdatedAt: () => client.getQueryState(queryKeys.session)?.dataUpdatedAt,
        staleTime: 30_000,
        refetchInterval: 30_000,
    });
}

export function clearTripHistoryOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.historyClear,
        scope: { id: 'account' },
        mutationFn: clearTripHistory,
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.tripRecords }),
        onSuccess: () => client.setQueryData(queryKeys.tripRecords, EMPTY_TRIP_RECORDS),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.tripRecords }),
        gcTime: Infinity,
    });
}

export function useTripRecords(): TripRecord[] {
    const client = useQueryClient();
    return useQuery(tripRecordsQuery(client)).data;
}

export function useClearTripHistory(): () => void {
    const client = useQueryClient();
    const clear = useMutation(clearTripHistoryOptions(client));
    return clear.mutate;
}
