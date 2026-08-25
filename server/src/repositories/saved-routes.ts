// Depot des itineraires sauvegardes par l'utilisateur.
import type { Database } from '../db/index.ts';
import type { SavedRouteRecord } from '../../../src/types.ts';
import { SAVED_ROUTES_LIMIT } from './limits.ts';
import { encodeModes, measures, point, type Row } from './mappers.ts';

export function createSavedRouteRepository(db: Database) {
  return {
    list(userId: string): SavedRouteRecord[] {
      const rows = db
        .query('SELECT * FROM saved_routes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
        .all(userId, SAVED_ROUTES_LIMIT) as Row[];

      return rows.map((row) => ({
        id: String(row.id),
        userId,
        routeId: String(row.route_id),
        routeTitle: String(row.route_title),
        origin: point(row, 'origin'),
        destination: point(row, 'destination'),
        ...measures(row),
        score: Number(row.score),
        createdAt: String(row.created_at),
      }));
    },

    upsert(userId: string, record: Omit<SavedRouteRecord, 'userId'>): void {
      db.query(
        `INSERT INTO saved_routes
           (id, user_id, route_id, route_title, origin_label, origin_lat, origin_lon, destination_label,
            destination_lat, destination_lon, modes, distance_km, duration_minutes, carbon_grams,
            carbon_saved_grams, score, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, id) DO UPDATE SET
           route_title = excluded.route_title,
           score = excluded.score,
           created_at = excluded.created_at`,
      ).run(
        record.id,
        userId,
        record.routeId,
        record.routeTitle,
        record.origin.label,
        record.origin.lat,
        record.origin.lon,
        record.destination.label,
        record.destination.lat,
        record.destination.lon,
        encodeModes(record.modes),
        record.distanceKm,
        record.durationMinutes,
        record.carbonGrams,
        record.carbonSavedGrams,
        record.score,
        record.createdAt,
      );

      db.query(
        `DELETE FROM saved_routes
          WHERE user_id = ?
            AND id NOT IN (SELECT id FROM saved_routes WHERE user_id = ? ORDER BY created_at DESC LIMIT ?)`,
      ).run(userId, userId, SAVED_ROUTES_LIMIT);
    },

    delete(userId: string, recordId: string): void {
      db.query('DELETE FROM saved_routes WHERE user_id = ? AND id = ?').run(userId, recordId);
    },
  };
}

export type SavedRouteRepository = ReturnType<typeof createSavedRouteRepository>;
