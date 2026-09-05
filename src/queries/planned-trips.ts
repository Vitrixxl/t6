// Trajets programmés : lecture de la ressource et commandes qui la modifient.
// Chaque succès applique uniquement la réponse du serveur au cache concerne.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { PlannedTrip } from '../types';
import { recordTrip } from '../lib/carbon';
import { cancelPlannedTrip, completePlannedTrip, deletePlannedTrip, fetchPlannedTrips, savePlannedTrip } from '../lib/api/planned-trips';
import { createPlannedTrip, removePlanned, upcomingTrips, upsertPlanned, type TripSource } from '../lib/trips';
import { useNow } from '../state/clock';
import { mutationKeys, queryKeys } from './keys';
import { readTripRecords } from './trip-records';
import { readSession } from './session';

const EMPTY_PLANNED_TRIPS: PlannedTrip[] = [];

export function readPlannedTrips(client: QueryClient): PlannedTrip[] {
    return client.getQueryData<PlannedTrip[]>(queryKeys.plannedTrips)
        ?? readSession(client)?.state.plannedTrips
        ?? EMPTY_PLANNED_TRIPS;
}

export function plannedTripsQuery(client: QueryClient) {
    return queryOptions({
        queryKey: queryKeys.plannedTrips,
        queryFn: fetchPlannedTrips,
        initialData: () => readSession(client)?.state.plannedTrips ?? EMPTY_PLANNED_TRIPS,
        initialDataUpdatedAt: () => client.getQueryState(queryKeys.session)?.dataUpdatedAt,
        staleTime: 60_000,
    });
}

export function savePlannedTripOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.plannedSave,
        scope: { id: 'account' },
        mutationFn: savePlannedTrip,
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.plannedTrips }),
        onSuccess: (saved) => client.setQueryData(queryKeys.plannedTrips, upsertPlanned(readPlannedTrips(client), saved)),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.plannedTrips }),
        gcTime: Infinity,
    });
}

export function completePlannedTripOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.plannedComplete,
        scope: { id: 'account' },
        mutationFn: (trip: PlannedTrip) => completePlannedTrip(trip.id),
        onMutate: () => Promise.all([
            client.cancelQueries({ queryKey: queryKeys.plannedTrips }),
            client.cancelQueries({ queryKey: queryKeys.tripRecords }),
        ]),
        onSuccess: ({ plannedTrip, tripRecord }) => {
            client.setQueryData(queryKeys.plannedTrips, upsertPlanned(readPlannedTrips(client), plannedTrip));
            client.setQueryData(queryKeys.tripRecords, recordTrip(readTripRecords(client), tripRecord));
        },
        onError: () => Promise.all([
            client.invalidateQueries({ queryKey: queryKeys.plannedTrips }),
            client.invalidateQueries({ queryKey: queryKeys.tripRecords }),
        ]),
        gcTime: Infinity,
    });
}

export function cancelPlannedTripOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.plannedCancel,
        scope: { id: 'account' },
        mutationFn: (trip: PlannedTrip) => cancelPlannedTrip(trip.id),
        onMutate: () => Promise.all([
            client.cancelQueries({ queryKey: queryKeys.plannedTrips }),
            client.cancelQueries({ queryKey: queryKeys.tripRecords }),
        ]),
        onSuccess: (saved) => {
            client.setQueryData(queryKeys.plannedTrips, upsertPlanned(readPlannedTrips(client), saved));
            client.setQueryData(queryKeys.tripRecords,
                readTripRecords(client).filter((record) => record.id !== `trip:${saved.id}`));
        },
        onError: () => Promise.all([
            client.invalidateQueries({ queryKey: queryKeys.plannedTrips }),
            client.invalidateQueries({ queryKey: queryKeys.tripRecords }),
        ]),
        gcTime: Infinity,
    });
}

export function deletePlannedTripOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.plannedDelete,
        scope: { id: 'account' },
        mutationFn: (trip: PlannedTrip) => deletePlannedTrip(trip.id),
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.plannedTrips }),
        onSuccess: (_result, trip) => client.setQueryData(queryKeys.plannedTrips, removePlanned(readPlannedTrips(client), trip.id)),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.plannedTrips }),
        gcTime: Infinity,
    });
}

export function usePlannedTrips(): PlannedTrip[] {
    const client = useQueryClient();
    return useQuery(plannedTripsQuery(client)).data;
}

export function useUpcomingTrips(): PlannedTrip[] {
    const planned = usePlannedTrips();
    const now = useNow();
    return useMemo(() => upcomingTrips(planned, now), [planned, now]);
}

export function usePlanTrip(): (source: TripSource, scheduledFor: Date) => void {
    const client = useQueryClient();
    const userId = readSession(client)?.user.id;
    const save = useMutation(savePlannedTripOptions(client));
    return useCallback((source: TripSource, scheduledFor: Date) => {
        if (userId) {
            save.mutate(createPlannedTrip(userId, source, scheduledFor));
        }
    }, [save, userId]);
}

export function useMarkTripDone(): (trip: PlannedTrip) => void {
    const client = useQueryClient();
    const complete = useMutation(completePlannedTripOptions(client));
    return complete.mutate;
}

export function useCancelTrip(): (trip: PlannedTrip) => void {
    const client = useQueryClient();
    const cancel = useMutation(cancelPlannedTripOptions(client));
    return cancel.mutate;
}

export function useRemoveTrip(): (trip: PlannedTrip) => void {
    const client = useQueryClient();
    const remove = useMutation(deletePlannedTripOptions(client));
    return remove.mutate;
}
