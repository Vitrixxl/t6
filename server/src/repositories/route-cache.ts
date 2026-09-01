// Depot du cache de traces. Seule couche a connaitre le SQL du cache.
import type { Database } from '../db/index.ts';

export interface CachedRoute {
  payload: string;
  ageMs: number;
}

export function createRouteCacheRepository(db: Database) {
  const selectStatement = db.query<{ payload_json: string; created_at: number }, [string]>(
    'SELECT payload_json, created_at FROM route_cache WHERE cache_key = ?',
  );
  const upsertStatement = db.query(
    `INSERT INTO route_cache (cache_key, mode, payload_json, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json, created_at = excluded.created_at`,
  );
  const purgeStatement = db.query('DELETE FROM route_cache WHERE created_at < ?');

  return {
    find(key: string): CachedRoute | null {
      const row = selectStatement.get(key);
      return row ? { payload: row.payload_json, ageMs: Date.now() - row.created_at } : null;
    },
    save(key: string, routeMode: string, payload: string): void {
      upsertStatement.run(key, routeMode, payload, Date.now());
    },
    /** Purge les entrees expirees. Sans elle, le cache grossit sans fin. */
    purgeOlderThan(ttlMs: number): void {
      purgeStatement.run(Date.now() - ttlMs);
    },
  };
}

export type RouteCacheRepository = ReturnType<typeof createRouteCacheRepository>;
