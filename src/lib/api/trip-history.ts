import { api, treatyRequest } from './client';

export async function clearTripHistory(): Promise<void> {
  await treatyRequest(api.trips.history.delete());
}
