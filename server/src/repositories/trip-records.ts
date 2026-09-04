// Dépôt de l'historique des trajets réalisés (alimente par la transition
// serveur d'un trajet programmé). Le client ne peut pas injecter une liste.
import { and, desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { tripRecords } from '../db/schema.ts';
import type { TripRecord } from '../../../src/types.ts';
import { TRIP_HISTORY_LIMIT } from '../../../src/contracts/limits.ts';
import { measures } from './mappers.ts';

type TripRecordRow = typeof tripRecords.$inferSelect;

function toTripRecord(row: TripRecordRow): TripRecord {
    return {
        id: row.id,
        userId: row.userId,
        routeTitle: row.routeTitle,
        ...measures(row),
        createdAt: row.createdAt,
    };
}

export function createTripRecordRepository(db: Executor) {
    return {
        list(userId: string): TripRecord[] {
            return db
                .select()
                .from(tripRecords)
                .where(eq(tripRecords.userId, userId))
                .orderBy(desc(tripRecords.createdAt))
                .limit(TRIP_HISTORY_LIMIT)
                .all()
                .map(toTripRecord);
        },

        findById(userId: string, id: string): TripRecord | null {
            const row = db
                .select()
                .from(tripRecords)
                .where(and(eq(tripRecords.userId, userId), eq(tripRecords.id, id)))
                .get();
            return row ? toTripRecord(row) : null;
        },

        upsert(record: TripRecord): void {
            db.insert(tripRecords)
                .values(record)
                .onConflictDoUpdate({
                    target: [tripRecords.userId, tripRecords.id],
                    set: {
                        routeTitle: record.routeTitle,
                        modes: record.modes,
                        distanceKm: record.distanceKm,
                        durationMinutes: record.durationMinutes,
                        carbonGrams: record.carbonGrams,
                        carbonSavedGrams: record.carbonSavedGrams,
                        createdAt: record.createdAt,
                    },
                })
                .run();
        },

        deleteById(userId: string, id: string): void {
            db.delete(tripRecords)
                .where(and(eq(tripRecords.userId, userId), eq(tripRecords.id, id)))
                .run();
        },

        /** Seule l'action utilisateur « effacer l'historique » appelle cette opération. */
        clear(userId: string): void {
            db.delete(tripRecords).where(eq(tripRecords.userId, userId)).run();
        },

        prune(userId: string): void {
            const overflow = db
                .select({ id: tripRecords.id })
                .from(tripRecords)
                .where(eq(tripRecords.userId, userId))
                .orderBy(desc(tripRecords.createdAt))
                .all()
                .slice(TRIP_HISTORY_LIMIT);
            for (const row of overflow) {
                db.delete(tripRecords)
                    .where(and(eq(tripRecords.userId, userId), eq(tripRecords.id, row.id)))
                    .run();
            }
        },
    };
}

export type TripRecordRepository = ReturnType<typeof createTripRecordRepository>;
