// Routines : lecture, creation, pause et suppression de la ressource visee.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { RecurringTrip } from '../types';
import { deleteRecurringTrip, fetchRecurringTrips, saveRecurringTrip } from '../lib/api/recurring-trips';
import { createRecurringTrip, isRoutinePaused, removeRecurring, setRecurringPaused, upsertRecurring, type TripSource } from '../lib/trips';
import { mutationKeys, queryKeys } from './keys';
import { readSession } from './session';

export interface RoutineSchedule {
    daysOfWeek: number[];
    departureTime: string;
    returnTime: string | null;
}

const EMPTY_RECURRING_TRIPS: RecurringTrip[] = [];

export function readRecurringTrips(client: QueryClient): RecurringTrip[] {
    return client.getQueryData<RecurringTrip[]>(queryKeys.recurringTrips)
        ?? readSession(client)?.state.recurringTrips
        ?? EMPTY_RECURRING_TRIPS;
}

export function recurringTripsQuery(client: QueryClient) {
    return queryOptions({
        queryKey: queryKeys.recurringTrips,
        queryFn: fetchRecurringTrips,
        initialData: () => readSession(client)?.state.recurringTrips ?? EMPTY_RECURRING_TRIPS,
        initialDataUpdatedAt: () => client.getQueryState(queryKeys.session)?.dataUpdatedAt,
        staleTime: 60_000,
    });
}

function updateRecurringTrips(client: QueryClient, update: (trips: RecurringTrip[]) => RecurringTrip[]): void {
    client.setQueryData(queryKeys.recurringTrips, update(readRecurringTrips(client)));
}

function reloadRecurringTrips(client: QueryClient): Promise<void> {
    return client.invalidateQueries({ queryKey: queryKeys.recurringTrips }).then(() => undefined);
}

export function saveRecurringTripOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.recurringSave,
        scope: { id: 'account' },
        mutationFn: saveRecurringTrip,
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.recurringTrips }),
        onSuccess: (saved) => updateRecurringTrips(client, (trips) => upsertRecurring(trips, saved)),
        onError: () => reloadRecurringTrips(client),
        gcTime: Infinity,
    });
}

export function deleteRecurringTripOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.recurringDelete,
        scope: { id: 'account' },
        mutationFn: (routine: RecurringTrip) => deleteRecurringTrip(routine.id),
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.recurringTrips }),
        onSuccess: (_result, routine) => updateRecurringTrips(client, (trips) => removeRecurring(trips, routine.id)),
        onError: () => reloadRecurringTrips(client),
        gcTime: Infinity,
    });
}

export function useRecurringTrips(): RecurringTrip[] {
    const client = useQueryClient();
    return useQuery(recurringTripsQuery(client)).data;
}

export function useCreateRoutine(): (source: TripSource, schedule: RoutineSchedule) => void {
    const client = useQueryClient();
    const userId = readSession(client)?.user.id;
    const save = useMutation(saveRecurringTripOptions(client));
    return useCallback((source: TripSource, schedule: RoutineSchedule) => {
        if (userId) {
            save.mutate(createRecurringTrip(userId, source, schedule));
        }
    }, [save, userId]);
}

export function useToggleRoutinePaused(): (routine: RecurringTrip) => void {
    const client = useQueryClient();
    const save = useMutation(saveRecurringTripOptions(client));
    return useCallback((routine: RecurringTrip) => {
        const updated = setRecurringPaused([routine], routine.id, !isRoutinePaused(routine))[0] ?? routine;
        save.mutate(updated);
    }, [save]);
}

export function useRemoveRoutine(): (routine: RecurringTrip) => void {
    const client = useQueryClient();
    const remove = useMutation(deleteRecurringTripOptions(client));
    return useCallback((routine: RecurringTrip) => remove.mutate(routine), [remove]);
}
