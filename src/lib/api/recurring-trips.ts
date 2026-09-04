import type { RecurringTrip } from '../../contracts';
import { api, resourceBody, treatyRequest } from './client';

export function saveRecurringTrip(record: RecurringTrip): Promise<RecurringTrip> {
  return treatyRequest(api.trips.recurring({ id: record.id }).put(resourceBody(record)));
}

export async function deleteRecurringTrip(id: string): Promise<void> {
  await treatyRequest(api.trips.recurring({ id }).delete());
}
