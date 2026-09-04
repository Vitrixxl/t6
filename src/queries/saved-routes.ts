// Itineraires enregistres : lecture, enregistrement d'une option calculee,
// retrait.
import { useCallback } from 'react';
import type { AccountState } from '../contracts';
import type { GeoPoint, RouteOption, SavedRouteRecord } from '../types';
import { deleteSavedRoute as deleteSavedRouteRequest, saveSavedRoute } from '../lib/api';
import { addSavedRoute, createSavedRouteRecord, removeSavedRoute } from '../lib/savedRoutes';
import { useAccountMutation, useAccountPart, type AccountMutation } from './account';
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

export const savedRouteSaveMutation = {
    key: 'saved-route-save',
    parts: ['savedRoutes'],
    mutationFn: saveSavedRoute,
    optimistic: (state, record) => ({ savedRoutes: addSavedRoute(state.savedRoutes, record) }),
    reconcile: (state, record) => ({ savedRoutes: addSavedRoute(state.savedRoutes, record) }),
} satisfies AccountMutation<SavedRouteRecord, SavedRouteRecord>;

export const savedRouteDeleteMutation = {
    key: 'saved-route-delete',
    parts: ['savedRoutes'],
    mutationFn: deleteSavedRouteRequest,
    optimistic: (state, recordId) => deleteSavedRoute(state, recordId),
    reconcile: (state, _result, recordId) => deleteSavedRoute(state, recordId),
} satisfies AccountMutation<string, void>;

export function useSaveRoute(): (input: SaveRouteInput) => void {
    const user = useUser();
    const save = useAccountMutation(savedRouteSaveMutation);
    return useCallback(
        (input: SaveRouteInput) => save(createSavedRouteRecord(user.id, input.origin, input.destination, input.option)),
        [save, user.id],
    );
}

export function useDeleteSavedRoute(): (recordId: string) => void {
    const remove = useAccountMutation(savedRouteDeleteMutation);
    return useCallback((recordId: string) => remove(recordId), [remove]);
}
