// Depot de l'historique des trajets realises (alimente le suivi carbone).
import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { tripRecords } from '../db/schema.ts';
import type { TripRecord } from '../../../src/types.ts';
import { TRIP_HISTORY_LIMIT } from './limits.ts';
import { measures } from './mappers.ts';

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
        .map((row) => ({
          id: row.id,
          userId,
          routeTitle: row.routeTitle,
          ...measures(row),
          createdAt: row.createdAt,
        }));
    },

    insert(userId: string, record: Omit<TripRecord, 'userId'>): void {
      // DO NOTHING plutot que DO UPDATE : un trajet realise est un fait
      // historique, le rejouer ne doit pas le reecrire.
      db.insert(tripRecords)
        .values({ ...record, userId })
        .onConflictDoNothing({ target: [tripRecords.userId, tripRecords.id] })
        .run();

      // Minimisation : on ne conserve que les plus recents.
      const kept = db
        .select({ id: tripRecords.id })
        .from(tripRecords)
        .where(eq(tripRecords.userId, userId))
        .orderBy(desc(tripRecords.createdAt))
        .limit(TRIP_HISTORY_LIMIT);
      db.delete(tripRecords)
        .where(and(eq(tripRecords.userId, userId), notInArray(tripRecords.id, kept)))
        .run();
    },

    clear(userId: string): void {
      db.delete(tripRecords).where(eq(tripRecords.userId, userId)).run();
    },
  };
}

export type TripRecordRepository = ReturnType<typeof createTripRecordRepository>;
