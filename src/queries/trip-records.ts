// Historique des trajets realises : lecture et effacement. Il s'alimente par
// les trajets marques faits (planned-trips.ts), jamais directement.
import { useCallback } from 'react';
import type { AccountState } from '../contracts';
import type { TripRecord } from '../types';
import { useAccountPart, useAccountWrite } from './account';

export function useTripRecords(): TripRecord[] {
  return useAccountPart('tripRecords');
}

export function clearTripHistory(): Partial<AccountState> {
  return { tripRecords: [] };
}

export function useClearTripHistory(): () => void {
  const write = useAccountWrite();
  return useCallback(() => write(clearTripHistory), [write]);
}
