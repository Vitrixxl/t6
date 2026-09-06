// Trajets programmés : la lecture comptabilise les échéances passées.
// Le statut et son entrée carbone sont persistés ensemble pour éviter les
// doublons et respecter un effacement volontaire de l’historique.
import type { Db } from '../db/index.ts';
import { createPlannedTripRepository } from '../repositories/planned-trips.ts';
import { createTripRecordRepository } from '../repositories/trip-records.ts';
import { PAST_TRIP_RETENTION_MONTHS, type PlannedTrip, type TripRecord } from '../../../src/contracts/index.ts';

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

/** Date avant laquelle un ponctuel passé n'est plus conservé. */
function retentionCutoff(now: Date): string {
    const cutoff = new Date(now);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - PAST_TRIP_RETENTION_MONTHS);
    return cutoff.toISOString();
}

/**
 * La date prévue décide de la réalisation ; la transaction garde l’historique
 * cohérent. Les ponctuels passés depuis plus de PAST_TRIP_RETENTION_MONTHS
 * sont ensuite effacés : la réalisation précède la purge, pour qu'un trajet
 * jamais relu depuis sa date compte quand même dans le bilan carbone.
 */
export function completeDueTrips(db: Db, userId: string, now = new Date()): void {
    db.transaction((tx) => {
        const plannedTrips = createPlannedTripRepository(tx);
        const tripRecords = createTripRecordRepository(tx);
        for (const trip of plannedTrips.list(userId)) {
            if (trip.status === 'cancelled') continue;
            const due = new Date(trip.scheduledFor) < now;
            if (!due) {
                // Corrige aussi les anciens trajets cochés manuellement avant leur date.
                if (trip.status === 'done') {
                    plannedTrips.upsert({ ...trip, status: 'planned', completedAt: null });
                    tripRecords.deleteById(userId, 'trip:' + trip.id);
                }
                continue;
            }
            if (trip.status === 'done' && trip.completedAt === trip.scheduledFor) continue;
            const completed: PlannedTrip = { ...trip, status: 'done', completedAt: trip.scheduledFor };
            plannedTrips.upsert(completed);
            // Un historique volontairement effacé ne doit pas réapparaître.
            if (trip.status === 'planned' || tripRecords.findById(userId, 'trip:' + trip.id)) {
                tripRecords.upsert(toTripRecord(completed));
            }
        }
        plannedTrips.deletePastBefore(userId, retentionCutoff(now));
        tripRecords.prune(userId);
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

/** Rétablir retire l’annulation ; la date décide si le trajet revient dans le bilan. */
export function restorePlannedTrip(db: Db, userId: string, id: string, now = new Date()): PlannedTrip | null {
    return db.transaction((tx) => {
        const plannedTrips = createPlannedTripRepository(tx);
        const tripRecords = createTripRecordRepository(tx);
        const current = plannedTrips.findById(userId, id);
        if (!current || current.status !== 'cancelled') return current;
        const due = new Date(current.scheduledFor) < now;
        const restored: PlannedTrip = { ...current, status: due ? 'done' : 'planned', completedAt: due ? current.scheduledFor : null };
        plannedTrips.upsert(restored);
        if (due) {
            tripRecords.upsert(toTripRecord(restored));
            tripRecords.prune(userId);
        }
        return restored;
    });
}
