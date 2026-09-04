// Commandes des trajets programmes. La completion est une transition metier
// atomique : elle modifie le trajet et cree son entree carbone dans la meme
// transaction, y compris lors d'un rejeu apres une reponse perdue.
import type { Db } from '../db/index.ts';
import { createRepositories } from '../repositories/index.ts';
import type { CompletedPlannedTrip, PlannedTrip, TripRecord } from '../../../src/contracts/index.ts';

function toTripRecord(trip: PlannedTrip): TripRecord {
    return {
        id: `trip:${trip.id}`,
        userId: trip.userId,
        routeTitle: trip.label,
        modes: trip.modes,
        distanceKm: trip.distanceKm,
        durationMinutes: trip.durationMinutes,
        carbonGrams: trip.carbonGrams,
        carbonSavedGrams: trip.carbonSavedGrams,
        createdAt: trip.completedAt ?? trip.scheduledFor,
    };
}

/** Enregistre une ressource et elague uniquement un eventuel surplus. */
export function savePlannedTrip(db: Db, trip: PlannedTrip): PlannedTrip | null {
    return db.transaction((tx) => {
        const repository = createRepositories(tx).plannedTrips;
        repository.upsert(trip);
        repository.prune(trip.userId);
        return repository.findById(trip.userId, trip.id);
    });
}

export function deletePlannedTrip(db: Db, userId: string, id: string): void {
    createRepositories(db).plannedTrips.deleteById(userId, id);
}

export function completePlannedTrip(db: Db, userId: string, id: string, now = new Date()): CompletedPlannedTrip | null {
    return db.transaction((tx) => {
        const repositories = createRepositories(tx);
        const current = repositories.plannedTrips.findById(userId, id);
        if (!current) {
            return null;
        }

        const plannedTrip: PlannedTrip =
            current.status === 'done' && current.completedAt
                ? current
                : { ...current, status: 'done', completedAt: current.completedAt ?? now.toISOString() };
        const tripRecord = toTripRecord(plannedTrip);

        repositories.plannedTrips.upsert(plannedTrip);
        repositories.tripRecords.upsert(tripRecord);
        repositories.tripRecords.prune(userId);
        return { plannedTrip, tripRecord };
    });
}
