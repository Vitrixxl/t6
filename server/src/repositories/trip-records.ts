// Depot de l'historique des trajets realises (alimente le suivi carbone).
import type { Database } from '../db/index.ts';
import type { TripRecord } from '../../../src/types.ts';
import { TRIP_HISTORY_LIMIT } from './limits.ts';
import { encodeModes, measures, type Row } from './mappers.ts';

export function createTripRecordRepository(db: Database) {
  return {
    list(userId: string): TripRecord[] {
      const rows = db
        .query('SELECT * FROM trip_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
        .all(userId, TRIP_HISTORY_LIMIT) as Row[];

      return rows.map((row) => ({
        id: String(row.id),
        userId,
        routeTitle: String(row.route_title),
        ...measures(row),
        createdAt: String(row.created_at),
      }));
    },

    insert(userId: string, record: Omit<TripRecord, 'userId'>): void {
      // DO NOTHING plutot que DO UPDATE : un trajet realise est un fait
      // historique, le rejouer ne doit pas le reecrire.
      db.query(
        `INSERT INTO trip_records
           (id, user_id, route_title, modes, distance_km, duration_minutes, carbon_grams, carbon_saved_grams, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO NOTHING`,
      ).run(
        record.id,
        userId,
        record.routeTitle,
        encodeModes(record.modes),
        record.distanceKm,
        record.durationMinutes,
        record.carbonGrams,
        record.carbonSavedGrams,
        record.createdAt,
      );

      db.query(
        `DELETE FROM trip_records
          WHERE user_id = ?
            AND id NOT IN (SELECT id FROM trip_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)`,
      ).run(userId, userId, TRIP_HISTORY_LIMIT);
    },

    clear(userId: string): void {
      db.query('DELETE FROM trip_records WHERE user_id = ?').run(userId);
    },
  };
}

export type TripRecordRepository = ReturnType<typeof createTripRecordRepository>;
