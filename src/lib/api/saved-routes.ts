import type { SavedRouteRecord } from '../../contracts';
import { api, resourceBody, treatyRequest } from './client';

export function fetchSavedRoutes(): Promise<SavedRouteRecord[]> {
    return treatyRequest(api['saved-routes'].get());
}

export function saveSavedRoute(record: SavedRouteRecord): Promise<SavedRouteRecord> {
    return treatyRequest(api['saved-routes']({ id: record.id }).put(resourceBody(record)));
}

export async function deleteSavedRoute(id: string): Promise<void> {
    await treatyRequest(api['saved-routes']({ id }).delete());
}
