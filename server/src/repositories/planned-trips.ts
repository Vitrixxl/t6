// Depot des trajets programmes (occurrences datees, ponctuelles ou issues
// d'une routine).
import type { Database } from '../db/index.ts';
import type { PlannedTrip } from '../../../src/types.ts';
import { PLANNED_LIMIT } from './limits.ts';
import { encodeModes, measures, nullableText, point, type Row } from './mappers.ts';

export function createPlannedTripRepository(db: Database) {
  return {
    list(userId: string): PlannedTrip[] {
      const rows = db
        .query('SELECT * FROM planned_trips WHERE user_id = ? ORDER BY scheduled_for ASC LIMIT ?')
        .all(userId, PLANNED_LIMIT) as Row[];

      return rows.map((row) => ({
        id: String(row.id),
        userId,
        label: String(row.label),
        origin: point(row, 'origin'),
        destination: point(row, 'destination'),
        ...measures(row),
        scheduledFor: String(row.scheduled_for),
        status: String(row.status) as PlannedTrip['status'],
        recurringTripId: nullableText(row.recurring_trip_id),
        createdAt: String(row.created_at),
        completedAt: nullableText(row.completed_at),
      }));
    },

    upsert(userId: string, trip: Omit<PlannedTrip, 'userId'>): void {
      // L'identifiant vient du client (deterministe pour une occurrence de
      // routine) : l'upsert rend l'operation rejouable sans doublon.
      db.query(
        `INSERT INTO planned_trips
           (id, user_id, label, origin_label, origin_lat, origin_lon, destination_label, destination_lat,
            destination_lon, modes, distance_km, duration_minutes, carbon_grams, carbon_saved_grams,
            scheduled_for, status, recurring_trip_id, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO UPDATE SET
           label = excluded.label,
           scheduled_for = excluded.scheduled_for,
           status = excluded.status,
           completed_at = excluded.completed_at,
           modes = excluded.modes,
           distance_km = excluded.distance_km,
           duration_minutes = excluded.duration_minutes,
           carbon_grams = excluded.carbon_grams,
           carbon_saved_grams = excluded.carbon_saved_grams`,
      ).run(
        trip.id,
        userId,
        trip.label,
        trip.origin.label,
        trip.origin.lat,
        trip.origin.lon,
        trip.destination.label,
        trip.destination.lat,
        trip.destination.lon,
        encodeModes(trip.modes),
        trip.distanceKm,
        trip.durationMinutes,
        trip.carbonGrams,
        trip.carbonSavedGrams,
        trip.scheduledFor,
        trip.status,
        trip.recurringTripId,
        trip.createdAt,
        trip.completedAt,
      );
    },

    delete(userId: string, tripId: string): void {
      db.query('DELETE FROM planned_trips WHERE user_id = ? AND id = ?').run(userId, tripId);
    },

    /** Occurrences engendrees par une routine : elles la suivent a la suppression. */
    deleteByRecurring(userId: string, recurringTripId: string): void {
      db.query('DELETE FROM planned_trips WHERE user_id = ? AND recurring_trip_id = ?').run(userId, recurringTripId);
    },
  };
}

export type PlannedTripRepository = ReturnType<typeof createPlannedTripRepository>;
