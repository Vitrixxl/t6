// Depot de l'historique des trajets realises (alimente le suivi carbone).
import { desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { tripRecords } from '../db/schema.ts';
import type { TripRecord } from '../../../src/types.ts';
import { TRIP_HISTORY_LIMIT } from '../../../src/contracts/limits.ts';
import { chunks, measures } from './mappers.ts';

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

    /** Remplace l'historique par celui du client. Minimisation : seuls les plus recents sont gardes. */
    replaceAll(userId: string, records: Omit<TripRecord, 'userId'>[]): void {
      db.delete(tripRecords).where(eq(tripRecords.userId, userId)).run();
      const rows = [...records]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, TRIP_HISTORY_LIMIT)
        .map((record) => ({ ...record, userId }));
      for (const batch of chunks(rows)) {
        db.insert(tripRecords).values(batch).run();
      }
    },
  };
}

export type TripRecordRepository = ReturnType<typeof createTripRecordRepository>;
