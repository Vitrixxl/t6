import type { CompletedPlannedTrip, PlannedTrip } from '../../contracts';
import { api, treatyRequest } from './client';

export function fetchPlannedTrips(): Promise<PlannedTrip[]> {
    return treatyRequest(api.trips.planned.get());
}

export function savePlannedTrip(record: PlannedTrip): Promise<PlannedTrip> {
    const { id, userId, ...body } = record;
    void userId;
    if (body.status === 'done' || body.completedAt !== null) {
        throw new Error('Un trajet terminé passe par la commande de complétion.');
    }
    return treatyRequest(api.trips.planned({ id }).put({ ...body, status: body.status, completedAt: null }));
}

export function completePlannedTrip(id: string): Promise<CompletedPlannedTrip> {
    return treatyRequest(api.trips.planned({ id }).completion.put());
}

export async function deletePlannedTrip(id: string): Promise<void> {
    await treatyRequest(api.trips.planned({ id }).delete());
}

export function cancelPlannedTrip(id: string): Promise<PlannedTrip> {
    return treatyRequest(api.trips.planned({ id }).cancellation.put());
}
