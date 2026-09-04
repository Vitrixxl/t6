// Service de routage : cache partagé devant le calculateur d'itinéraires.
//
// Trois raisons de passer par l'API plutôt que d'appeler le calculateur depuis
// le navigateur :
//
//   - le quota d'une instance publique se compte par adresse IP, pas par
//     utilisateur : mille navigateurs derrière la même sortie réseau épuisent
//     le même quota, et rien ne le mutualise (B13) ;
//   - un cache partagé sert le même trajet à tous sans le recalculer, ce qui
//     protège la source et vaut aussi comme mesure d'éco-conception ;
//   - chaque moteur possède une URL configurable : passer aux trois moteurs
//     auto-hébergés ne touche pas une ligne de code client.
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
        async route(mode: RoutableMode, from: Coordinates, to: Coordinates): Promise<RoutingResult | null> {
            const key = cacheKey(mode, from, to);
            const row = cache.find(key);
            const cached = cachedGeometry(row);
            if (cached && row && row.ageMs < config.routeCacheTtlMs) {
                return cached;
            }

            const geometry = await fetchUpstreamRoute(config.osrmUrls, mode, from, to);
            if (!geometry) {
                // Le calculateur ne répond pas. Une entrée expirée vaut mieux qu'aucune
                // réponse : la voirie n'a pas changé, et l'alternative serait une carte
                // vide. C'est le seul cas où l'on sert une donnée périmée.
                if (cached) {
                    return cached;
                }
                return null;
            }

            cache.save(key, mode, JSON.stringify(geometry));
            cache.purgeOlderThan(config.routeCacheTtlMs);
            return { ...geometry, source: 'upstream' };
        },

        async matrix(
            mode: RoutableMode,
            origins: Coordinates[],
            destinations: Coordinates[],
        ): Promise<RoutingMatrixResult | null> {
            const known = origins.map((from) => destinations.map((to) => findMeasure(cache, mode, from, to)));
            const allFresh = known.every((row) => row.every((entry) => entry && entry.ageMs < config.routeCacheTtlMs));
            if (allFresh) {
                return {
                    measures: known.map((row) =>
                        row.map((entry): RoutingMeasure | null => entry ? { ...entry.measure, source: 'cache' } : null),
                    ),
                };
            }

            const upstream = await fetchUpstreamMatrix(config.osrmUrls, mode, origins, destinations);
            if (!upstream) {
                const measures = known.map((row) =>
                    row.map((entry): RoutingMeasure | null => entry ? { ...entry.measure, source: 'cache' } : null),
                );
                return measures.some((row) => row.some(Boolean)) ? { measures } : null;
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
