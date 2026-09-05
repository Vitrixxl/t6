// Service de routage : cache partagé devant le calculateur d'itinéraires.
//
// L’API mutualise les mesures et tracés des moteurs locaux dans le cache SQLite.
// Les trois profils gardent des adresses distinctes ; aucun appel ne bascule
// vers un service public en cas de panne.
import { routeGeometry as routeGeometryContract, routeMeasure as routeMeasureContract } from '../../../../src/contracts/index.ts';
import type { RoutableMode } from '../../../../src/types.ts';
import type { ServerConfig } from '../../config/index.ts';
import type { CachedRoute, RouteCacheRepository } from '../../repositories/route-cache.ts';
import { fetchUpstreamMatrix, fetchUpstreamRoute, type RouteGeometry, type RouteMeasure } from './osrm.ts';

/**
 * Précision de la clé de cache, en décimales de degré. Cinq décimales valent
 * environ un mètre : deux départs distants d'un mètre empruntent la même rue.
 */
const KEY_PRECISION = 5;

export interface RoutingResult extends RouteGeometry {
    source: 'cache' | 'upstream';
}

export interface RoutingMeasure extends RouteMeasure {
    source: 'cache' | 'upstream';
}

export interface RoutingMatrixResult {
    measures: Array<Array<RoutingMeasure | null>>;
}

function cacheKey(mode: RoutableMode, from: Coordinates, to: Coordinates): string {
    const round = (value: number) => value.toFixed(KEY_PRECISION);
    return `${mode}:${round(from.lat)},${round(from.lon)}:${round(to.lat)},${round(to.lon)}`;
}

/** Les mesures sans géométrie partagent la table, sous un espace de clés distinct. */
function measureCacheKey(mode: RoutableMode, from: Coordinates, to: Coordinates): string {
    return `measure:${cacheKey(mode, from, to)}`;
}

export interface Coordinates {
    lat: number;
    lon: number;
}

function parseJson(payload: string): unknown {
    try {
        return JSON.parse(payload) as unknown;
    } catch {
        return null;
    }
}

function cachedGeometry(row: CachedRoute | null): RoutingResult | null {
    if (!row) {
        return null;
    }
    const parsed = routeGeometryContract.omit({ source: true }).safeParse(parseJson(row.payload));
    return parsed.success ? { ...parsed.data, source: 'cache' } : null;
}

function cachedMeasure(row: CachedRoute | null): RouteMeasure | null {
    if (!row) {
        return null;
    }
    const parsed = routeMeasureContract.omit({ source: true }).safeParse(parseJson(row.payload));
    return parsed.success ? parsed.data : null;
}

function findMeasure(cache: RouteCacheRepository, mode: RoutableMode, from: Coordinates, to: Coordinates) {
    const geometryRow = cache.find(cacheKey(mode, from, to));
    const geometry = cachedGeometry(geometryRow);
    const measureRow = cache.find(measureCacheKey(mode, from, to));
    const measure = cachedMeasure(measureRow);
    const fromGeometry = geometryRow && geometry
        ? {
            measure: { distanceMeters: geometry.distanceMeters, durationSeconds: geometry.durationSeconds },
            ageMs: geometryRow.ageMs,
        }
        : null;
    const fromMatrix = measureRow && measure ? { measure, ageMs: measureRow.ageMs } : null;

    if (!fromGeometry) {
        return fromMatrix;
    }
    if (!fromMatrix) {
        return fromGeometry;
    }
    return fromGeometry.ageMs <= fromMatrix.ageMs ? fromGeometry : fromMatrix;
}

export function createRoutingService(config: ServerConfig, cache: RouteCacheRepository) {
    return {
        async route(mode: RoutableMode, from: Coordinates, to: Coordinates, signal?: AbortSignal): Promise<RoutingResult | null> {
            const key = cacheKey(mode, from, to);
            const row = cache.find(key);
            const cached = cachedGeometry(row);
            if (cached && row && row.ageMs < config.routeCacheTtlMs) {
                return cached;
            }

            const geometry = await fetchUpstreamRoute(config.osrmUrls, mode, from, to, signal);
            if (!geometry) {
                // Le calculateur ne répond pas. Une entrée expirée vaut mieux qu'aucune
                // réponse : la voirie n'a pas changé, et l'alternative serait une carte
                // vide. C'est le seul cas où l'on sert une donnée périmée.
                return cached;
            }

            cache.save(key, mode, JSON.stringify(geometry));
            cache.purgeOlderThan(config.routeCacheTtlMs);
            return { ...geometry, source: 'upstream' };
        },

        async matrix(
            mode: RoutableMode,
            origins: Coordinates[],
            destinations: Coordinates[],
            signal?: AbortSignal,
        ): Promise<RoutingMatrixResult | null> {
            const known = origins.map((from) => destinations.map((to) => findMeasure(cache, mode, from, to)));
            const cachedMeasures = known.map((row) =>
                row.map((entry): RoutingMeasure | null => entry ? { ...entry.measure, source: 'cache' } : null),
            );
            const allFresh = known.every((row) => row.every((entry) => entry && entry.ageMs < config.routeCacheTtlMs));
            if (allFresh) {
                return { measures: cachedMeasures };
            }

            const upstream = await fetchUpstreamMatrix(config.osrmUrls, mode, origins, destinations, signal);
            if (!upstream) {
                return cachedMeasures.some((row) => row.some(Boolean)) ? { measures: cachedMeasures } : null;
            }

            const measures = upstream.map((row, originIndex) =>
                row.map((measure, destinationIndex): RoutingMeasure | null => {
                    if (measure) {
                        cache.save(
                            measureCacheKey(mode, origins[originIndex], destinations[destinationIndex]),
                            mode,
                            JSON.stringify(measure),
                        );
                        return { ...measure, source: 'upstream' };
                    }
                    const fallback = known[originIndex]?.[destinationIndex];
                    return fallback ? { ...fallback.measure, source: 'cache' } : null;
                }),
            );
            cache.purgeOlderThan(config.routeCacheTtlMs);
            return { measures };
        },
    };
}
