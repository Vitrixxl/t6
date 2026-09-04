// Depot des itineraires sauvegardes par l'utilisateur.
import { desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { savedRoutes } from '../db/schema.ts';
import type { SavedRouteRecord } from '../../../src/types.ts';
import { SAVED_ROUTES_LIMIT } from '../../../src/contracts/limits.ts';
import { chunks, endpoints, flattenEndpoints, measures } from './mappers.ts';

export function createSavedRouteRepository(db: Executor) {
  return {
    list(userId: string): SavedRouteRecord[] {
      return db
        .select()
        .from(savedRoutes)
        .where(eq(savedRoutes.userId, userId))
        .orderBy(desc(savedRoutes.createdAt))
        .limit(SAVED_ROUTES_LIMIT)
        .all()
        .map((row) => ({
          id: row.id,
          userId,
          routeId: row.routeId,
          routeTitle: row.routeTitle,
          ...endpoints(row),
          ...measures(row),
          score: row.score,
          createdAt: row.createdAt,
        }));
    },

    /** Remplace les itineraires sauvegardes par ceux du client. Seuls les plus recents sont gardes. */
    replaceAll(userId: string, records: Omit<SavedRouteRecord, 'userId'>[]): void {
      db.delete(savedRoutes).where(eq(savedRoutes.userId, userId)).run();
      const rows = [...records]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, SAVED_ROUTES_LIMIT)
        .map(({ origin, destination, ...rest }) => ({ ...rest, ...flattenEndpoints({ origin, destination }), userId }));
      for (const batch of chunks(rows)) {
        db.insert(savedRoutes).values(batch).run();
      }
    },
  };
}

export type SavedRouteRepository = ReturnType<typeof createSavedRouteRepository>;
