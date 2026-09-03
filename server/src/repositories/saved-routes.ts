// Depot des itineraires sauvegardes par l'utilisateur.
import { and, desc, eq, notInArray } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { savedRoutes } from '../db/schema.ts';
import type { SavedRouteRecord } from '../../../src/types.ts';
import { SAVED_ROUTES_LIMIT } from './limits.ts';
import { endpoints, flattenEndpoints, measures } from './mappers.ts';

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

    upsert(userId: string, record: Omit<SavedRouteRecord, 'userId'>): void {
      const { origin, destination, ...rest } = record;
      db.insert(savedRoutes)
        .values({ ...rest, ...flattenEndpoints({ origin, destination }), userId })
        .onConflictDoUpdate({
          target: [savedRoutes.userId, savedRoutes.id],
          set: { routeTitle: record.routeTitle, score: record.score, createdAt: record.createdAt },
        })
        .run();

      const kept = db
        .select({ id: savedRoutes.id })
        .from(savedRoutes)
        .where(eq(savedRoutes.userId, userId))
        .orderBy(desc(savedRoutes.createdAt))
        .limit(SAVED_ROUTES_LIMIT);
      db.delete(savedRoutes)
        .where(and(eq(savedRoutes.userId, userId), notInArray(savedRoutes.id, kept)))
        .run();
    },

    delete(userId: string, recordId: string): void {
      db.delete(savedRoutes).where(and(eq(savedRoutes.userId, userId), eq(savedRoutes.id, recordId))).run();
    },
  };
}

export type SavedRouteRepository = ReturnType<typeof createSavedRouteRepository>;
