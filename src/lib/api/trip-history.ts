import { api, treatyRequest } from './client';
import type { TripRecord } from '../../contracts';

export function fetchTripRecords(): Promise<TripRecord[]> {
    return treatyRequest(api.trips.history.get());
}

export async function clearTripHistory(): Promise<void> {
    await treatyRequest(api.trips.history.delete());
}
