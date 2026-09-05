// Itinéraires enregistrés : lecture, ajout et suppression par identifiant.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { GeoPoint, RouteOption, SavedRouteRecord } from '../types';
import { deleteSavedRoute, fetchSavedRoutes, saveSavedRoute } from '../lib/api/saved-routes';
import { addSavedRoute, createSavedRouteRecord, removeSavedRoute } from '../lib/savedRoutes';
import { mutationKeys, queryKeys } from './keys';
import { readSession } from './session';

export interface SaveRouteInput {
    option: RouteOption;
    origin: GeoPoint;
    destination: GeoPoint;
}

const EMPTY_SAVED_ROUTES: SavedRouteRecord[] = [];

export function readSavedRoutes(client: QueryClient): SavedRouteRecord[] {
    return client.getQueryData<SavedRouteRecord[]>(queryKeys.savedRoutes)
        ?? readSession(client)?.state.savedRoutes
        ?? EMPTY_SAVED_ROUTES;
}

export function savedRoutesQuery(client: QueryClient) {
    return queryOptions({
        queryKey: queryKeys.savedRoutes,
        queryFn: fetchSavedRoutes,
        initialData: () => readSession(client)?.state.savedRoutes ?? EMPTY_SAVED_ROUTES,
        initialDataUpdatedAt: () => client.getQueryState(queryKeys.session)?.dataUpdatedAt,
        staleTime: 60_000,
    });
}

export function saveSavedRouteOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.savedRouteSave,
        scope: { id: 'account' },
        mutationFn: saveSavedRoute,
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.savedRoutes }),
        onSuccess: (saved) => client.setQueryData(queryKeys.savedRoutes, addSavedRoute(readSavedRoutes(client), saved)),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.savedRoutes }),
        gcTime: Infinity,
    });
}

export function deleteSavedRouteOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.savedRouteDelete,
        scope: { id: 'account' },
        mutationFn: deleteSavedRoute,
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.savedRoutes }),
        onSuccess: (_result, id) => client.setQueryData(queryKeys.savedRoutes, removeSavedRoute(readSavedRoutes(client), id)),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.savedRoutes }),
        gcTime: Infinity,
    });
}

export function useSavedRoutes(): SavedRouteRecord[] {
    const client = useQueryClient();
    return useQuery(savedRoutesQuery(client)).data;
}

export function useSaveRoute(): (input: SaveRouteInput) => void {
    const client = useQueryClient();
    const userId = readSession(client)?.user.id;
    const save = useMutation(saveSavedRouteOptions(client));
    return useCallback((input: SaveRouteInput) => {
        if (userId) {
            save.mutate(createSavedRouteRecord(userId, input.origin, input.destination, input.option));
        }
    }, [save, userId]);
}

export function useDeleteSavedRoute(): (recordId: string) => void {
    const client = useQueryClient();
    const remove = useMutation(deleteSavedRouteOptions(client));
    return remove.mutate;
}
