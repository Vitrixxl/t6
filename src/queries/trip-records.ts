// Historique des trajets realises : lecture et effacement. Il s'alimente par
// les trajets marques faits (planned-trips.ts), jamais directement.
import { useCallback } from 'react';
import type { AccountState } from '../contracts';
import type { TripRecord } from '../types';
import { clearTripHistory as clearTripHistoryRequest } from '../lib/api';
import { useAccountMutation, useAccountPart, type AccountMutation } from './account';

export function useTripRecords(): TripRecord[] {
  return useAccountPart('tripRecords');
}

export function clearTripHistory(): Partial<AccountState> {
  return { tripRecords: [] };
}

export const tripHistoryClearMutation = {
  key: 'history-clear',
  parts: ['tripRecords'],
  mutationFn: (_variables) => clearTripHistoryRequest(),
  optimistic: () => clearTripHistory(),
  reconcile: () => clearTripHistory(),
} satisfies AccountMutation<undefined, void>;

export function useClearTripHistory(): () => void {
  const clear = useAccountMutation(tripHistoryClearMutation);
  return useCallback(() => clear(undefined), [clear]);
}
