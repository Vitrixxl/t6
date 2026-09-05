// Routines : lecture, création, pause et suppression de la ressource visée.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { TripDirection } from '../contracts';
import type { RecurringTrip } from '../types';
import { restoreRecurringPassage, cancelRecurringDate, deleteRecurringTrip, fetchRecurringTrips, saveRecurringTrip } from '../lib/api/recurring-trips';
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

export function saveRecurringTripOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.recurringSave,
        scope: { id: 'account' },
        mutationFn: saveRecurringTrip,
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.recurringTrips }),
        onSuccess: (saved) => client.setQueryData(queryKeys.recurringTrips, upsertRecurring(readRecurringTrips(client), saved)),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.recurringTrips }),
        gcTime: Infinity,
    });
}

export function deleteRecurringTripOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.recurringDelete,
        scope: { id: 'account' },
        mutationFn: (routine: RecurringTrip) => deleteRecurringTrip(routine.id),
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.recurringTrips }),
        onSuccess: (_result, routine) => client.setQueryData(queryKeys.recurringTrips, removeRecurring(readRecurringTrips(client), routine.id)),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.recurringTrips }),
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
        const updated = setRecurringPaused(routine, !isRoutinePaused(routine));
        save.mutate(updated);
    }, [save]);
}

export function useRemoveRoutine(): (routine: RecurringTrip) => void {
    const client = useQueryClient();
    const remove = useMutation(deleteRecurringTripOptions(client));
    return remove.mutate;
}

export interface CancelRoutineDate {
    id: string;
    date: string;
    directions: TripDirection[];
}

export function cancelRecurringDateOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.recurringCancel,
        scope: { id: 'account' },
        mutationFn: ({ id, date, directions }: CancelRoutineDate) => cancelRecurringDate(id, date, directions),
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.recurringTrips }),
        onSuccess: (saved) => client.setQueryData(queryKeys.recurringTrips, upsertRecurring(readRecurringTrips(client), saved)),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.recurringTrips }),
        gcTime: Infinity,
    });
}

export function useCancelRoutineDate(): (input: CancelRoutineDate) => void {
    const client = useQueryClient();
    const cancel = useMutation(cancelRecurringDateOptions(client));
    return cancel.mutate;
}

export function useRestoreRoutinePassage() {
    const client = useQueryClient();
    const restore = useMutation({
        mutationKey: mutationKeys.recurringRestore,
        scope: { id: 'account' },
        mutationFn: ({ id, date, direction }: { id: string; date: string; direction: TripDirection }) => restoreRecurringPassage(id, date, direction),
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.recurringTrips }),
        onSuccess: (saved) => client.setQueryData(queryKeys.recurringTrips, upsertRecurring(readRecurringTrips(client), saved)),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.recurringTrips }),
        gcTime: Infinity,
    });
    return restore.mutate;
}
