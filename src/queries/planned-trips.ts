// Trajets programmés : lecture de la ressource et commandes qui la modifient.
// Chaque succès applique uniquement la réponse du serveur au cache concerne.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { PlannedTrip, TripRecord } from '../types';
import { recordTrip } from '../lib/carbon';
import { completePlannedTrip, deletePlannedTrip, fetchPlannedTrips, savePlannedTrip } from '../lib/api/planned-trips';
import { createPlannedTrip, removePlanned, upcomingTrips, upsertPlanned, type TripSource } from '../lib/trips';
import { mutationKeys, queryKeys } from './keys';
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

function updatePlannedTrips(client: QueryClient, update: (trips: PlannedTrip[]) => PlannedTrip[]): void {
    client.setQueryData(queryKeys.plannedTrips, update(readPlannedTrips(client)));
}

function reloadPlannedTrips(client: QueryClient): Promise<void> {
    return client.invalidateQueries({ queryKey: queryKeys.plannedTrips }).then(() => undefined);
}

export function savePlannedTripOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.plannedSave,
        scope: { id: 'account' },
        mutationFn: savePlannedTrip,
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.plannedTrips }),
        onSuccess: (saved) => updatePlannedTrips(client, (trips) => upsertPlanned(trips, saved)),
        onError: () => reloadPlannedTrips(client),
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
            updatePlannedTrips(client, (trips) => upsertPlanned(trips, plannedTrip));
            const currentRecords = client.getQueryData<TripRecord[]>(queryKeys.tripRecords)
                ?? readSession(client)?.state.tripRecords
                ?? [];
            client.setQueryData(queryKeys.tripRecords, recordTrip(currentRecords, tripRecord));
        },
        onError: () => Promise.all([
            reloadPlannedTrips(client),
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
        onSuccess: (_result, trip) => updatePlannedTrips(client, (trips) => removePlanned(trips, trip.id)),
        onError: () => reloadPlannedTrips(client),
        gcTime: Infinity,
    });
}

export function usePlannedTrips(): PlannedTrip[] {
    const client = useQueryClient();
    return useQuery(plannedTripsQuery(client)).data;
}

export function useUpcomingTrips(): PlannedTrip[] {
    const planned = usePlannedTrips();
    return useMemo(() => upcomingTrips(planned), [planned]);
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
    return useCallback((trip: PlannedTrip) => complete.mutate(trip), [complete]);
}

export function useCancelTrip(): (trip: PlannedTrip) => void {
    const client = useQueryClient();
    const save = useMutation(savePlannedTripOptions(client));
    return useCallback(
        (trip: PlannedTrip) => save.mutate({ ...trip, status: 'cancelled', completedAt: null }),
        [save],
    );
}

export function useRemoveTrip(): (trip: PlannedTrip) => void {
    const client = useQueryClient();
    const remove = useMutation(deletePlannedTripOptions(client));
    return useCallback((trip: PlannedTrip) => remove.mutate(trip), [remove]);
}
