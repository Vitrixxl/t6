// Depot des trajets programmes a une date. Une commande ne touche qu'une
// ligne identifiee par (utilisateur, id) ; le depot ne recoit jamais la vue
// complete tenue par le client.
import { and, asc, desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { plannedTrips } from '../db/schema.ts';
import type { PlannedTrip } from '../../../src/types.ts';
import { PLANNED_LIMIT } from '../../../src/contracts/limits.ts';
import { endpoints, flattenEndpoints, measures } from './mappers.ts';

type PlannedTripRow = typeof plannedTrips.$inferSelect;

function toPlannedTrip(row: PlannedTripRow): PlannedTrip {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    ...endpoints(row),
    ...measures(row),
    scheduledFor: row.scheduledFor,
    status: row.status,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  };
}

function valuesOf(trip: PlannedTrip): typeof plannedTrips.$inferInsert {
  const { origin, destination, ...values } = trip;
  return { ...values, ...flattenEndpoints({ origin, destination }) };
}

export function createPlannedTripRepository(db: Executor) {
  const deleteById = (userId: string, id: string): void => {
    db.delete(plannedTrips)
      .where(and(eq(plannedTrips.userId, userId), eq(plannedTrips.id, id)))
      .run();
  };

  return {
    list(userId: string): PlannedTrip[] {
      return db
        .select()
        .from(plannedTrips)
        .where(eq(plannedTrips.userId, userId))
        .orderBy(asc(plannedTrips.scheduledFor))
        .limit(PLANNED_LIMIT)
        .all()
        .map(toPlannedTrip);
    },

    findById(userId: string, id: string): PlannedTrip | null {
      const row = db
        .select()
        .from(plannedTrips)
        .where(and(eq(plannedTrips.userId, userId), eq(plannedTrips.id, id)))
        .get();
      return row ? toPlannedTrip(row) : null;
    },

    upsert(trip: PlannedTrip): void {
      const row = valuesOf(trip);
      db.insert(plannedTrips)
        .values(row)
        .onConflictDoUpdate({
          target: [plannedTrips.userId, plannedTrips.id],
          set: {
            label: row.label,
            originLabel: row.originLabel,
            originLat: row.originLat,
            originLon: row.originLon,
            destinationLabel: row.destinationLabel,
            destinationLat: row.destinationLat,
            destinationLon: row.destinationLon,
            modes: row.modes,
            distanceKm: row.distanceKm,
            durationMinutes: row.durationMinutes,
            carbonGrams: row.carbonGrams,
            carbonSavedGrams: row.carbonSavedGrams,
            scheduledFor: row.scheduledFor,
            status: row.status,
            createdAt: row.createdAt,
            completedAt: row.completedAt,
          },
        })
        .run();
    },

    deleteById,

    /** La conservation bornee retire seulement les lignes surnumeraires. */
    prune(userId: string): void {
      const overflow = db
        .select({ id: plannedTrips.id })
        .from(plannedTrips)
        .where(eq(plannedTrips.userId, userId))
        .orderBy(desc(plannedTrips.scheduledFor))
        .all()
        .slice(PLANNED_LIMIT);
      for (const row of overflow) {
        deleteById(userId, row.id);
      }
    },
  };
}

export type PlannedTripRepository = ReturnType<typeof createPlannedTripRepository>;
