import type { PlannedTrip } from '../../contracts';
import { api, treatyRequest } from './client';

export function fetchPlannedTrips(): Promise<PlannedTrip[]> {
    return treatyRequest(api.trips.planned.get());
}

export function savePlannedTrip(record: PlannedTrip): Promise<PlannedTrip> {
    const { id, userId, ...body } = record;
    void userId;
    if (body.status === 'done' || body.completedAt !== null) {
        throw new Error('La réalisation d’un trajet est déterminée par le serveur à sa date prévue.');
    }
    return treatyRequest(api.trips.planned({ id }).put({ ...body, status: body.status, completedAt: null }));
}

export async function deletePlannedTrip(id: string): Promise<void> {
    await treatyRequest(api.trips.planned({ id }).delete());
}

export function cancelPlannedTrip(id: string): Promise<PlannedTrip> {
    return treatyRequest(api.trips.planned({ id }).cancellation.put());
}

export function restorePlannedTrip(id: string): Promise<PlannedTrip> {
    return treatyRequest(api.trips.planned({ id }).cancellation.delete());
}
