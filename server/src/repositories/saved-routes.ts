// Depot des itineraires sauvegardes par l'utilisateur. Un enregistrement est
// remplace ou retire sans recharger les autres dans la commande SQL.
import { and, desc, eq } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { savedRoutes } from '../db/schema.ts';
import type { SavedRouteRecord } from '../../../src/types.ts';
import { SAVED_ROUTES_LIMIT } from '../../../src/contracts/limits.ts';
import { endpoints, flattenEndpoints, measures } from './mappers.ts';

type SavedRouteRow = typeof savedRoutes.$inferSelect;

function toSavedRoute(row: SavedRouteRow): SavedRouteRecord {
  return {
    id: row.id,
    userId: row.userId,
    routeId: row.routeId,
    routeTitle: row.routeTitle,
    ...endpoints(row),
    ...measures(row),
    score: row.score,
    createdAt: row.createdAt,
  };
}

function valuesOf(record: SavedRouteRecord): typeof savedRoutes.$inferInsert {
  const { origin, destination, ...values } = record;
  return { ...values, ...flattenEndpoints({ origin, destination }) };
}

export function createSavedRouteRepository(db: Executor) {
  const deleteById = (userId: string, id: string): void => {
    db.delete(savedRoutes)
      .where(and(eq(savedRoutes.userId, userId), eq(savedRoutes.id, id)))
      .run();
  };

  return {
    list(userId: string): SavedRouteRecord[] {
      return db
        .select()
        .from(savedRoutes)
        .where(eq(savedRoutes.userId, userId))
        .orderBy(desc(savedRoutes.createdAt))
        .limit(SAVED_ROUTES_LIMIT)
        .all()
        .map(toSavedRoute);
    },

    findById(userId: string, id: string): SavedRouteRecord | null {
      const row = db
        .select()
        .from(savedRoutes)
        .where(and(eq(savedRoutes.userId, userId), eq(savedRoutes.id, id)))
        .get();
      return row ? toSavedRoute(row) : null;
    },

    upsert(record: SavedRouteRecord): void {
      const row = valuesOf(record);
      db.insert(savedRoutes)
        .values(row)
        .onConflictDoUpdate({
          target: [savedRoutes.userId, savedRoutes.id],
          set: {
            routeId: row.routeId,
            routeTitle: row.routeTitle,
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
            score: row.score,
            createdAt: row.createdAt,
          },
        })
        .run();
    },

    deleteById,

    prune(userId: string): void {
      const overflow = db
        .select({ id: savedRoutes.id })
        .from(savedRoutes)
        .where(eq(savedRoutes.userId, userId))
        .orderBy(desc(savedRoutes.createdAt))
        .all()
        .slice(SAVED_ROUTES_LIMIT);
      for (const row of overflow) {
        deleteById(userId, row.id);
      }
    },
  };
}

export type SavedRouteRepository = ReturnType<typeof createSavedRouteRepository>;
