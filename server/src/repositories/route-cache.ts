// Dépôt du cache de traces. Seule couche a connaître la table du cache.
import { eq, lt } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { routeCache } from '../db/schema.ts';

export interface CachedRoute {
    payload: string;
    ageMs: number;
}

export function createRouteCacheRepository(db: Executor) {
    return {
        find(key: string): CachedRoute | null {
            const row = db
                .select({ payloadJson: routeCache.payloadJson, createdAt: routeCache.createdAt })
                .from(routeCache)
                .where(eq(routeCache.cacheKey, key))
                .get();
            return row ? { payload: row.payloadJson, ageMs: Date.now() - row.createdAt } : null;
        },

        save(key: string, routeMode: string, payload: string): void {
            const createdAt = Date.now();
            db.insert(routeCache)
                .values({ cacheKey: key, mode: routeMode, payloadJson: payload, createdAt })
                .onConflictDoUpdate({ target: routeCache.cacheKey, set: { payloadJson: payload, createdAt } })
                .run();
        },

        /** Purge les entrées expirées. Sans elle, le cache grossit sans fin. */
        purgeOlderThan(ttlMs: number): void {
            db.delete(routeCache).where(lt(routeCache.createdAt, Date.now() - ttlMs)).run();
        },
    };
}

export type RouteCacheRepository = ReturnType<typeof createRouteCacheRepository>;
