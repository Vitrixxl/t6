// Depot des routines (ex : aller-retour domicile-travail), adressees une par
// une par leur cle composee utilisateur/identifiant.
import { and, count, desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { recurringTrips } from '../db/schema.ts';
import type { RecurringTrip } from '../../../src/types.ts';
import { RECURRING_LIMIT } from '../../../src/contracts/limits.ts';
import { endpoints, flattenEndpoints, measures } from './mappers.ts';

type RecurringTripRow = typeof recurringTrips.$inferSelect;

function toRecurringTrip(row: RecurringTripRow): RecurringTrip {
  return {
    id: row.id,
    userId: row.userId,
    label: row.label,
    ...endpoints(row),
    ...measures(row),
    daysOfWeek: row.daysOfWeek,
    departureTime: row.departureTime,
    returnTime: row.returnTime,
    periods: row.periods,
    createdAt: row.createdAt,
  };
}

function valuesOf(trip: RecurringTrip): typeof recurringTrips.$inferInsert {
  const { origin, destination, ...values } = trip;
  return { ...values, ...flattenEndpoints({ origin, destination }) };
}

export function createRecurringTripRepository(db: Executor) {
  return {
    list(userId: string): RecurringTrip[] {
      return db
        .select()
        .from(recurringTrips)
        .where(eq(recurringTrips.userId, userId))
        .orderBy(desc(recurringTrips.createdAt))
        .limit(RECURRING_LIMIT)
        .all()
        .map(toRecurringTrip);
    },

    findById(userId: string, id: string): RecurringTrip | null {
      const row = db
        .select()
        .from(recurringTrips)
        .where(and(eq(recurringTrips.userId, userId), eq(recurringTrips.id, id)))
        .get();
      return row ? toRecurringTrip(row) : null;
    },

    count(userId: string): number {
      return db.select({ value: count() }).from(recurringTrips).where(eq(recurringTrips.userId, userId)).get()?.value ?? 0;
    },

    upsert(trip: RecurringTrip): void {
      const row = valuesOf(trip);
      db.insert(recurringTrips)
        .values(row)
        .onConflictDoUpdate({
          target: [recurringTrips.userId, recurringTrips.id],
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
            daysOfWeek: row.daysOfWeek,
            departureTime: row.departureTime,
            returnTime: row.returnTime,
            periods: row.periods,
            createdAt: row.createdAt,
          },
        })
        .run();
    },

    deleteById(userId: string, id: string): void {
      db.delete(recurringTrips)
        .where(and(eq(recurringTrips.userId, userId), eq(recurringTrips.id, id)))
        .run();
    },
  };
}

export type RecurringTripRepository = ReturnType<typeof createRecurringTripRepository>;
