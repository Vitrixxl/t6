// Routines : lecture, creation, pause et retrait.
//
// Une routine n'engendre aucun trajet : ses passages sont comptes a la
// lecture (lib/trips/routines.ts). Une pause clot sa periode d'activite, une
// reprise en ouvre une nouvelle.
import { useCallback } from 'react';
import type { AccountState } from '../contracts';
import type { RecurringTrip } from '../types';
import { createRecurringTrip, isRoutinePaused, removeRecurring, setRecurringPaused, upsertRecurring, type TripSource } from '../lib/trips';
import { useAccountPart, useAccountWrite } from './account';
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

export function useCreateRoutine(): (source: TripSource, schedule: RoutineSchedule) => void {
  const user = useUser();
  const write = useAccountWrite();
  return useCallback(
    (source: TripSource, schedule: RoutineSchedule) => write((state) => createRoutine(state, user.id, source, schedule)),
    [user.id, write],
  );
}

export function useToggleRoutinePaused(): (routine: RecurringTrip) => void {
  const write = useAccountWrite();
  return useCallback((routine: RecurringTrip) => write((state) => toggleRoutinePaused(state, routine)), [write]);
}

export function useRemoveRoutine(): (routine: RecurringTrip) => void {
  const write = useAccountWrite();
  return useCallback((routine: RecurringTrip) => write((state) => removeRoutine(state, routine)), [write]);
}
