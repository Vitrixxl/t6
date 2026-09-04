// Service de routage : cache partage devant le calculateur d'itineraires.
//
// Trois raisons de passer par l'API plutot que d'appeler le calculateur depuis
// le navigateur :
//
//   - le quota d'une instance publique se compte par adresse IP, pas par
//     utilisateur : mille navigateurs derriere la meme sortie reseau epuisent
//     le meme quota, et rien ne le mutualise (B13) ;
//   - un cache partage sert le meme trajet a tous sans le recalculer, ce qui
//     protege la source et vaut aussi comme mesure d'eco-conception ;
//   - l'URL du calculateur devient une variable de configuration : basculer sur
//     une instance auto-hebergee ne touche pas une ligne de code client.
import { routeGeometry as routeGeometryContract, routeMeasure as routeMeasureContract } from '../../../../src/contracts/index.ts';
import type { RoutableMode } from '../../../../src/types.ts';
import type { ServerConfig } from '../../config/index.ts';
import type { CachedRoute, RouteCacheRepository } from '../../repositories/route-cache.ts';
import { fetchUpstreamMatrix, fetchUpstreamRoute, type RouteGeometry, type RouteMeasure } from './osrm.ts';

/**
 * Precision de la cle de cache, en decimales de degre. Cinq decimales valent
 * environ un metre : deux departs distants d'un metre empruntent la meme rue.
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

/** Les mesures sans geometrie partagent la table, sous un espace de cles distinct. */
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

            const geometry = await fetchUpstreamRoute(config.osrmBaseUrl, mode, from, to);
            if (!geometry) {
                // Le calculateur ne repond pas. Une entree expiree vaut mieux qu'aucune
                // reponse : la voirie n'a pas change, et l'alternative serait une carte
                // vide. C'est le seul cas ou l'on sert une donnee perimee.
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

            const upstream = await fetchUpstreamMatrix(config.osrmBaseUrl, mode, origins, destinations);
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
