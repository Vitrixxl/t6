import type { CompletedPlannedTrip, PlannedTrip } from '../../contracts';
import { api, treatyRequest } from './client';

export function savePlannedTrip(record: PlannedTrip): Promise<PlannedTrip> {
  const { id, userId, ...body } = record;
  void userId;
  if (body.status === 'done' || body.completedAt !== null) {
    throw new Error('Un trajet termine passe par la commande de completion.');
  }
  return treatyRequest(api.trips.planned({ id }).put({ ...body, status: body.status, completedAt: null }));
}

export function completePlannedTrip(id: string): Promise<CompletedPlannedTrip> {
  return treatyRequest(api.trips.planned({ id }).completion.put());
}

export async function deletePlannedTrip(id: string): Promise<void> {
  await treatyRequest(api.trips.planned({ id }).delete());
}
