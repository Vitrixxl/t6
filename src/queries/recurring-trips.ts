// Routines : lecture, creation, pause et retrait.
//
// Une routine n'engendre aucun trajet : ses passages sont comptes a la
// lecture (lib/trips/routines.ts). Une pause clot sa periode d'activite, une
// reprise en ouvre une nouvelle.
import { useCallback } from 'react';
import type { AccountState } from '../contracts';
import type { RecurringTrip } from '../types';
import { deleteRecurringTrip, saveRecurringTrip } from '../lib/api';
import { createRecurringTrip, isRoutinePaused, removeRecurring, setRecurringPaused, upsertRecurring, type TripSource } from '../lib/trips';
import { useAccountMutation, useAccountPart, type AccountMutation } from './account';
import { useUser } from './user';

export interface RoutineSchedule {
  daysOfWeek: number[];
  departureTime: string;
  returnTime: string | null;
}

export function useRecurringTrips(): RecurringTrip[] {
  return useAccountPart('recurringTrips');
}

export function createRoutine(state: AccountState, userId: string, source: TripSource, schedule: RoutineSchedule): Partial<AccountState> {
  return { recurringTrips: upsertRecurring(state.recurringTrips, createRecurringTrip(userId, source, schedule)) };
}

export function toggleRoutinePaused(state: AccountState, routine: RecurringTrip): Partial<AccountState> {
  return { recurringTrips: setRecurringPaused(state.recurringTrips, routine.id, !isRoutinePaused(routine)) };
}

export function removeRoutine(state: AccountState, routine: RecurringTrip): Partial<AccountState> {
  return { recurringTrips: removeRecurring(state.recurringTrips, routine.id) };
}

export const recurringTripSaveMutation = {
  key: 'recurring-save',
  parts: ['recurringTrips'],
  mutationFn: saveRecurringTrip,
  optimistic: (state, routine) => ({ recurringTrips: upsertRecurring(state.recurringTrips, routine) }),
  reconcile: (state, routine) => ({ recurringTrips: upsertRecurring(state.recurringTrips, routine) }),
} satisfies AccountMutation<RecurringTrip, RecurringTrip>;

export const recurringTripDeleteMutation = {
  key: 'recurring-delete',
  parts: ['recurringTrips'],
  mutationFn: (routine) => deleteRecurringTrip(routine.id),
  optimistic: (state, routine) => removeRoutine(state, routine),
  reconcile: (state, _result, routine) => removeRoutine(state, routine),
} satisfies AccountMutation<RecurringTrip, void>;

export function useCreateRoutine(): (source: TripSource, schedule: RoutineSchedule) => void {
  const user = useUser();
  const save = useAccountMutation(recurringTripSaveMutation);
  return useCallback(
    (source: TripSource, schedule: RoutineSchedule) => save(createRecurringTrip(user.id, source, schedule)),
    [save, user.id],
  );
}

export function useToggleRoutinePaused(): (routine: RecurringTrip) => void {
  const save = useAccountMutation(recurringTripSaveMutation);
  return useCallback(
    (routine: RecurringTrip) => {
      const updated = setRecurringPaused([routine], routine.id, !isRoutinePaused(routine))[0] ?? routine;
      save(updated);
    },
    [save],
  );
}

export function useRemoveRoutine(): (routine: RecurringTrip) => void {
  const remove = useAccountMutation(recurringTripDeleteMutation);
  return useCallback((routine: RecurringTrip) => remove(routine), [remove]);
}
