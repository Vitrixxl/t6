// Depot des trajets programmes (occurrences datees, ponctuelles ou issues
// d'une routine).
import { asc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { plannedTrips } from '../db/schema.ts';
import type { PlannedTrip } from '../../../src/types.ts';
import { PLANNED_LIMIT } from './limits.ts';
import { chunks, endpoints, flattenEndpoints, measures } from './mappers.ts';

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

    /** Remplace les occurrences par celles du client. Au-dela de la borne, les plus anciennes sont ecartees. */
    replaceAll(userId: string, trips: Omit<PlannedTrip, 'userId'>[]): void {
      db.delete(plannedTrips).where(eq(plannedTrips.userId, userId)).run();
      const rows = [...trips]
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
        .slice(-PLANNED_LIMIT)
        .map(({ origin, destination, ...rest }) => ({ ...rest, ...flattenEndpoints({ origin, destination }), userId }));
      for (const batch of chunks(rows)) {
        db.insert(plannedTrips).values(batch).run();
      }
    },
  };
}

export type PlannedTripRepository = ReturnType<typeof createPlannedTripRepository>;
