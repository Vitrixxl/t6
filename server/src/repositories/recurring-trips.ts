// Depot des routines (ex : aller-retour domicile-travail).
import { desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { recurringTrips } from '../db/schema.ts';
import type { RecurringTrip } from '../../../src/types.ts';
import { chunks, endpoints, flattenEndpoints, measures } from './mappers.ts';

export function createRecurringTripRepository(db: Executor) {
  return {
    list(userId: string): RecurringTrip[] {
      return db
        .select()
        .from(recurringTrips)
        .where(eq(recurringTrips.userId, userId))
        .orderBy(desc(recurringTrips.createdAt))
        .all()
        .map((row) => ({
          id: row.id,
          userId,
          label: row.label,
          ...endpoints(row),
          ...measures(row),
          daysOfWeek: row.daysOfWeek,
          departureTime: row.departureTime,
          returnTime: row.returnTime,
          paused: row.paused,
          createdAt: row.createdAt,
        }));
    },

    /** Remplace les routines par celles du client. */
    replaceAll(userId: string, trips: Omit<RecurringTrip, 'userId'>[]): void {
      db.delete(recurringTrips).where(eq(recurringTrips.userId, userId)).run();
      const rows = trips.map(({ origin, destination, ...rest }) => ({
        ...rest,
        ...flattenEndpoints({ origin, destination }),
        userId,
      }));
      for (const batch of chunks(rows)) {
        db.insert(recurringTrips).values(batch).run();
      }
    },
  };
}

export type RecurringTripRepository = ReturnType<typeof createRecurringTripRepository>;
