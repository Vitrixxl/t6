// Trajets programmes : lecture, prochaines echeances, et les actions qui les
// font changer d'etat. Chaque action est une fonction pure sur l'etat du
// compte, exportee pour etre testee, et un hook qui l'ecrit.
import { useCallback, useMemo } from 'react';
import type { AccountState } from '../contracts';
import type { PlannedTrip } from '../types';
import { recordTrip } from '../lib/carbon';
import { createPlannedTrip, plannedTripToRecord, removePlanned, setPlannedStatus, upcomingTrips, upsertPlanned, type TripSource } from '../lib/trips';
import { useAccountPart, useAccountWrite } from './account';
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

export function usePlanTrip(): (source: TripSource, scheduledFor: Date) => void {
  const user = useUser();
  const write = useAccountWrite();
  return useCallback(
    (source: TripSource, scheduledFor: Date) => write((state) => planTrip(state, user.id, source, scheduledFor)),
    [user.id, write],
  );
}

export function useMarkTripDone(): (trip: PlannedTrip) => void {
  const write = useAccountWrite();
  return useCallback((trip: PlannedTrip) => write((state) => completeTrip(state, trip)), [write]);
}

export function useCancelTrip(): (trip: PlannedTrip) => void {
  const write = useAccountWrite();
  return useCallback((trip: PlannedTrip) => write((state) => cancelTrip(state, trip)), [write]);
}

export function useRemoveTrip(): (trip: PlannedTrip) => void {
  const write = useAccountWrite();
  return useCallback((trip: PlannedTrip) => write((state) => removeTrip(state, trip)), [write]);
}
