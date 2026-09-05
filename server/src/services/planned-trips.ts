// Commandes des trajets programmés. La complétion est une transition métier
// atomique : elle modifie le trajet et crée son entrée carbone dans la même
// transaction, y compris lors d'un rejeu après une réponse perdue.
import type { Db } from '../db/index.ts';
import { createPlannedTripRepository } from '../repositories/planned-trips.ts';
import { createTripRecordRepository } from '../repositories/trip-records.ts';
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
        const plannedTrips = createPlannedTripRepository(tx);
        const tripRecords = createTripRecordRepository(tx);
        const current = plannedTrips.findById(trip.userId, trip.id);
        // Une modification de formulaire ne doit pas rétablir un trajet terminé.
        if (current?.status === 'done' && trip.status !== 'cancelled') {
            return null;
        }
        if (trip.status === 'cancelled') {
            tripRecords.deleteById(trip.userId, `trip:${trip.id}`);
        }
        plannedTrips.upsert(trip);
        plannedTrips.prune(trip.userId);
        return plannedTrips.findById(trip.userId, trip.id);
    });
}

export function completePlannedTrip(db: Db, userId: string, id: string, now = new Date()): CompletedPlannedTrip | null {
    return db.transaction((tx) => {
        const plannedTrips = createPlannedTripRepository(tx);
        const tripRecords = createTripRecordRepository(tx);
        const current = plannedTrips.findById(userId, id);
        if (!current) {
            return null;
        }

        const plannedTrip: PlannedTrip =
            current.status === 'done' && current.completedAt
                ? current
                : { ...current, status: 'done', completedAt: current.completedAt ?? now.toISOString() };
        const tripRecord = toTripRecord(plannedTrip);

        plannedTrips.upsert(plannedTrip);
        tripRecords.upsert(tripRecord);
        tripRecords.prune(userId);
        return { plannedTrip, tripRecord };
    });
}

/** Annuler conserve le trajet pour l’historique et retire sa contribution carbone. */
export function cancelPlannedTrip(db: Db, userId: string, id: string): PlannedTrip | null {
    return db.transaction((tx) => {
        const plannedTrips = createPlannedTripRepository(tx);
        const tripRecords = createTripRecordRepository(tx);
        const current = plannedTrips.findById(userId, id);
        if (!current) {
            return null;
        }
        const cancelled: PlannedTrip = { ...current, status: 'cancelled', completedAt: null };
        plannedTrips.upsert(cancelled);
        tripRecords.deleteById(userId, `trip:${id}`);
        return cancelled;
    });
}
