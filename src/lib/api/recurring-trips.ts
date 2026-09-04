import type { RecurringTrip, TripDirection } from '../../contracts';
import { api, resourceBody, treatyRequest } from './client';

export function fetchRecurringTrips(): Promise<RecurringTrip[]> {
    return treatyRequest(api.trips.recurring.get());
}

export function saveRecurringTrip(record: RecurringTrip): Promise<RecurringTrip> {
    const { cancelledPassages, ...input } = resourceBody(record);
    void cancelledPassages;
    return treatyRequest(api.trips.recurring({ id: record.id }).put(input));
}

export async function deleteRecurringTrip(id: string): Promise<void> {
    await treatyRequest(api.trips.recurring({ id }).delete());
}

export function cancelRecurringDate(id: string, date: string, directions: TripDirection[]): Promise<RecurringTrip> {
    return treatyRequest(api.trips.recurring({ id }).cancellations({ date }).put({ directions }));
}
