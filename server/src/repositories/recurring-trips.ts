// Depot des routines (ex : aller-retour domicile-travail).
import type { Database } from '../db/index.ts';
import type { RecurringTrip } from '../../../src/types.ts';
import { encodeModes, measures, nullableText, point, type Row } from './mappers.ts';

export function createRecurringTripRepository(db: Database) {
  return {
    list(userId: string): RecurringTrip[] {
      const rows = db
        .query('SELECT * FROM recurring_trips WHERE user_id = ? ORDER BY created_at DESC')
        .all(userId) as Row[];

      return rows.map((row) => ({
        id: String(row.id),
        userId,
        label: String(row.label),
        origin: point(row, 'origin'),
        destination: point(row, 'destination'),
        ...measures(row),
        daysOfWeek: JSON.parse(String(row.days_of_week)) as number[],
        departureTime: String(row.departure_time),
        returnTime: nullableText(row.return_time),
        paused: Number(row.paused) === 1,
        createdAt: String(row.created_at),
      }));
    },

    upsert(userId: string, trip: Omit<RecurringTrip, 'userId'>): void {
      db.query(
        `INSERT INTO recurring_trips
           (id, user_id, label, origin_label, origin_lat, origin_lon, destination_label, destination_lat,
            destination_lon, modes, distance_km, duration_minutes, carbon_grams, carbon_saved_grams,
            days_of_week, departure_time, return_time, paused, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO UPDATE SET
           label = excluded.label,
           days_of_week = excluded.days_of_week,
           departure_time = excluded.departure_time,
           return_time = excluded.return_time,
           paused = excluded.paused`,
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
        JSON.stringify(trip.daysOfWeek),
        trip.departureTime,
        trip.returnTime,
        trip.paused ? 1 : 0,
        trip.createdAt,
      );
    },

    delete(userId: string, tripId: string): void {
      db.query('DELETE FROM recurring_trips WHERE user_id = ? AND id = ?').run(userId, tripId);
    },
  };
}

export type RecurringTripRepository = ReturnType<typeof createRecurringTripRepository>;
