// Depot des routines (ex : aller-retour domicile-travail).
import { and, desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { recurringTrips } from '../db/schema.ts';
import type { RecurringTrip } from '../../../src/types.ts';
import { endpoints, flattenEndpoints, measures } from './mappers.ts';

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

    upsert(userId: string, trip: Omit<RecurringTrip, 'userId'>): void {
      const { origin, destination, ...rest } = trip;
      db.insert(recurringTrips)
        .values({ ...rest, ...flattenEndpoints({ origin, destination }), userId })
        .onConflictDoUpdate({
          target: [recurringTrips.userId, recurringTrips.id],
          set: {
            label: trip.label,
            daysOfWeek: trip.daysOfWeek,
            departureTime: trip.departureTime,
            returnTime: trip.returnTime,
            paused: trip.paused,
          },
        })
        .run();
    },

    delete(userId: string, tripId: string): void {
      db.delete(recurringTrips).where(and(eq(recurringTrips.userId, userId), eq(recurringTrips.id, tripId))).run();
    },
  };
}

export type RecurringTripRepository = ReturnType<typeof createRecurringTripRepository>;
