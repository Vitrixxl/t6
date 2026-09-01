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
import type { MobilityMode } from '../../../../src/types.ts';
import type { ServerConfig } from '../../config/index.ts';
import type { RouteCacheRepository } from '../../repositories/route-cache.ts';
import { fetchUpstreamRoute, type RouteGeometry } from './osrm.ts';

/**
 * Precision de la cle de cache, en decimales de degre. Cinq decimales valent
 * environ un metre : deux departs distants d'un metre empruntent la meme rue.
 */
const KEY_PRECISION = 5;

export interface RoutingResult extends RouteGeometry {
  source: 'cache' | 'upstream';
}

function cacheKey(mode: MobilityMode, from: Coordinates, to: Coordinates): string {
  const round = (value: number) => value.toFixed(KEY_PRECISION);
  return `${mode}:${round(from.lat)},${round(from.lon)}:${round(to.lat)},${round(to.lon)}`;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export function createRoutingService(config: ServerConfig, cache: RouteCacheRepository) {
  return {
    async route(mode: MobilityMode, from: Coordinates, to: Coordinates): Promise<RoutingResult | null> {
      const key = cacheKey(mode, from, to);
      const cached = cache.find(key);
      if (cached && cached.ageMs < config.routeCacheTtlMs) {
        return { ...(JSON.parse(cached.payload) as RouteGeometry), source: 'cache' };
      }

      const geometry = await fetchUpstreamRoute(config.osrmBaseUrl, mode, from, to);
      if (!geometry) {
        // Le calculateur ne repond pas. Une entree expiree vaut mieux qu'aucune
        // reponse : la voirie n'a pas change, et l'alternative serait une carte
        // vide. C'est le seul cas ou l'on sert une donnee perimee.
        if (cached) {
          return { ...(JSON.parse(cached.payload) as RouteGeometry), source: 'cache' };
        }
        return null;
      }

      cache.save(key, mode, JSON.stringify(geometry));
      cache.purgeOlderThan(config.routeCacheTtlMs);
      return { ...geometry, source: 'upstream' };
    },
  };
}

export type RoutingService = ReturnType<typeof createRoutingService>;
