// Itineraires enregistres : lecture, enregistrement d'une option calculee,
// retrait.
import { useCallback } from 'react';
import type { AccountState } from '../contracts';
import type { GeoPoint, RouteOption, SavedRouteRecord } from '../types';
import { addSavedRoute, createSavedRouteRecord, removeSavedRoute } from '../lib/savedRoutes';
import { useAccountPart, useAccountWrite } from './account';
import { useUser } from './user';

export interface SaveRouteInput {
  option: RouteOption;
  origin: GeoPoint;
  destination: GeoPoint;
}

export function useSavedRoutes(): SavedRouteRecord[] {
  return useAccountPart('savedRoutes');
}

export function saveRoute(state: AccountState, userId: string, input: SaveRouteInput): Partial<AccountState> {
  const record = createSavedRouteRecord(userId, input.origin, input.destination, input.option);
  return { savedRoutes: addSavedRoute(state.savedRoutes, record) };
}

export function deleteSavedRoute(state: AccountState, recordId: string): Partial<AccountState> {
  return { savedRoutes: removeSavedRoute(state.savedRoutes, recordId) };
}

export function useSaveRoute(): (input: SaveRouteInput) => void {
  const user = useUser();
  const write = useAccountWrite();
  return useCallback((input: SaveRouteInput) => write((state) => saveRoute(state, user.id, input)), [user.id, write]);
}

export function useDeleteSavedRoute(): (recordId: string) => void {
  const write = useAccountWrite();
  return useCallback((recordId: string) => write((state) => deleteSavedRoute(state, recordId)), [write]);
}
