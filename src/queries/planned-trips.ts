// Trajets programmes : lecture, prochaines echeances, et les actions qui les
// font changer d'etat. Chaque action est une fonction pure sur l'etat du
// compte, exportee pour etre testee, et un hook qui l'ecrit.
import { useCallback, useMemo } from 'react';
import type { AccountState, CompletedPlannedTrip } from '../contracts';
import type { PlannedTrip } from '../types';
import { recordTrip } from '../lib/carbon';
import { completePlannedTrip, deletePlannedTrip, savePlannedTrip } from '../lib/api';
import { createPlannedTrip, plannedTripToRecord, removePlanned, setPlannedStatus, upcomingTrips, upsertPlanned, type TripSource } from '../lib/trips';
import { useAccountMutation, useAccountPart, type AccountMutation } from './account';
import { useUser } from './user';

export function usePlannedTrips(): PlannedTrip[] {
    return useAccountPart('plannedTrips');
}

export function useUpcomingTrips(): PlannedTrip[] {
    const planned = usePlannedTrips();
    return useMemo(() => upcomingTrips(planned), [planned]);
}

export function planTrip(state: AccountState, userId: string, source: TripSource, scheduledFor: Date): Partial<AccountState> {
    return { plannedTrips: upsertPlanned(state.plannedTrips, createPlannedTrip(userId, source, scheduledFor)) };
}

/**
 * Un trajet fait alimente l'historique carbone : c'est la seule transition
 * qui sort du domaine planification, d'ou deux parties remplacees.
 */
export function completeTrip(state: AccountState, trip: PlannedTrip): Partial<AccountState> {
    const plannedTrips = setPlannedStatus(state.plannedTrips, trip.id, 'done');
    const done = plannedTrips.find((item) => item.id === trip.id);
    return {
        plannedTrips,
        tripRecords: done ? recordTrip(state.tripRecords, plannedTripToRecord(done)) : state.tripRecords,
    };
}

export function cancelTrip(state: AccountState, trip: PlannedTrip): Partial<AccountState> {
    return { plannedTrips: setPlannedStatus(state.plannedTrips, trip.id, 'cancelled') };
}

export function removeTrip(state: AccountState, trip: PlannedTrip): Partial<AccountState> {
    return { plannedTrips: removePlanned(state.plannedTrips, trip.id) };
}

export const plannedTripSaveMutation = {
    key: 'planned-save',
    parts: ['plannedTrips'],
    mutationFn: savePlannedTrip,
    optimistic: (state, trip) => ({ plannedTrips: upsertPlanned(state.plannedTrips, trip) }),
    reconcile: (state, trip) => ({ plannedTrips: upsertPlanned(state.plannedTrips, trip) }),
} satisfies AccountMutation<PlannedTrip, PlannedTrip>;

export const plannedTripCompletionMutation = {
    key: 'planned-complete',
    parts: ['plannedTrips', 'tripRecords'],
    mutationFn: (trip) => completePlannedTrip(trip.id),
    optimistic: (state, trip) => completeTrip(state, trip),
    reconcile: (state, completed) => ({
        plannedTrips: upsertPlanned(state.plannedTrips, completed.plannedTrip),
        tripRecords: recordTrip(state.tripRecords, completed.tripRecord),
    }),
} satisfies AccountMutation<PlannedTrip, CompletedPlannedTrip>;

export const plannedTripDeleteMutation = {
    key: 'planned-delete',
    parts: ['plannedTrips'],
    mutationFn: (trip) => deletePlannedTrip(trip.id),
    optimistic: (state, trip) => removeTrip(state, trip),
    reconcile: (state, _result, trip) => removeTrip(state, trip),
} satisfies AccountMutation<PlannedTrip, void>;

export function usePlanTrip(): (source: TripSource, scheduledFor: Date) => void {
    const user = useUser();
    const save = useAccountMutation(plannedTripSaveMutation);
    return useCallback(
        (source: TripSource, scheduledFor: Date) => save(createPlannedTrip(user.id, source, scheduledFor)),
        [save, user.id],
    );
}

export function useMarkTripDone(): (trip: PlannedTrip) => void {
    const complete = useAccountMutation(plannedTripCompletionMutation);
    return useCallback((trip: PlannedTrip) => complete(trip), [complete]);
}

export function useCancelTrip(): (trip: PlannedTrip) => void {
    const save = useAccountMutation(plannedTripSaveMutation);
    return useCallback((trip: PlannedTrip) => save({ ...trip, status: 'cancelled', completedAt: null }), [save]);
}

export function useRemoveTrip(): (trip: PlannedTrip) => void {
    const remove = useAccountMutation(plannedTripDeleteMutation);
    return useCallback((trip: PlannedTrip) => remove(trip), [remove]);
}
