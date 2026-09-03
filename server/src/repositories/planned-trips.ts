// Depot des trajets programmes (occurrences datees, ponctuelles ou issues
// d'une routine).
import { and, asc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { plannedTrips } from '../db/schema.ts';
import type { PlannedTrip } from '../../../src/types.ts';
import { PLANNED_LIMIT } from './limits.ts';
import { endpoints, flattenEndpoints, measures } from './mappers.ts';

export function createPlannedTripRepository(db: Executor) {
  return {
    list(userId: string): PlannedTrip[] {
      return db
        .select()
        .from(plannedTrips)
        .where(eq(plannedTrips.userId, userId))
        .orderBy(asc(plannedTrips.scheduledFor))
        .limit(PLANNED_LIMIT)
        .all()
        .map((row) => ({
          id: row.id,
          userId,
          label: row.label,
          ...endpoints(row),
          ...measures(row),
          scheduledFor: row.scheduledFor,
          status: row.status,
          recurringTripId: row.recurringTripId,
          createdAt: row.createdAt,
          completedAt: row.completedAt,
        }));
    },

    upsert(userId: string, trip: Omit<PlannedTrip, 'userId'>): void {
      // L'identifiant vient du client (deterministe pour une occurrence de
      // routine) : l'upsert rend l'operation rejouable sans doublon.
      const { origin, destination, ...rest } = trip;
      db.insert(plannedTrips)
        .values({ ...rest, ...flattenEndpoints({ origin, destination }), userId })
        .onConflictDoUpdate({
          target: [plannedTrips.userId, plannedTrips.id],
          set: {
            label: trip.label,
            scheduledFor: trip.scheduledFor,
            status: trip.status,
            completedAt: trip.completedAt,
            ...measures(trip),
          },
        })
        .run();
    },

    delete(userId: string, tripId: string): void {
      db.delete(plannedTrips).where(and(eq(plannedTrips.userId, userId), eq(plannedTrips.id, tripId))).run();
    },

    /** Occurrences engendrees par une routine : elles la suivent a la suppression. */
    deleteByRecurring(userId: string, recurringTripId: string): void {
      db.delete(plannedTrips)
        .where(and(eq(plannedTrips.userId, userId), eq(plannedTrips.recurringTripId, recurringTripId)))
        .run();
    },
  };
}

export type PlannedTripRepository = ReturnType<typeof createPlannedTripRepository>;
