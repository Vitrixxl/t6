// Enrichissement des options calculees localement par le routage reel.
import type { GeoPoint, MobilityMode, RouteOption } from '../../../types';
import { fetchRouteGeometry } from './osrm';

export const LIVE_EMISSIONS_G_PER_KM: Record<MobilityMode | 'privateCar', number> = {
  walk: 0,
  bike: 4,
  scooter: 15,
  transit: 55,
  carpool: 85,
  privateCar: 180,
};

// Perimetre produit: la recherche est bornee a la metropole de Lyon.
// Deux sources complementaires, fusionnees :
// - BAN (api-adresse) pour les adresses et rues, filtree au departement 69 ;
// - Photon (OpenStreetMap) pour les quartiers, gares et lieux ("Part-Dieu",
//   "Croix-Rousse"...), que la BAN ignore, borne a la bbox de la metropole.

export async function enhanceRoutesWithLiveRouting(
  routes: RouteOption[],
  origin: GeoPoint,
  destination: GeoPoint,
  signal?: AbortSignal,
): Promise<RouteOption[]> {
  const enhancedRoutes = await Promise.all(
    routes.map(async (routeOption) => {
      const geometry = await fetchRouteGeometry(routeOption.modes[routeOption.modes.length - 1], origin, destination, signal);
      if (!geometry) {
        return routeOption;
      }
      const distanceKm = round(geometry.distanceMeters / 1000, 2);
      const durationMinutes = Math.max(Math.round(geometry.durationSeconds / 60), 1);
      const carbonGrams = estimateLiveCarbon(routeOption, distanceKm);
      const carbonSavedGrams = Math.max(Math.round(distanceKm * LIVE_EMISSIONS_G_PER_KM.privateCar - carbonGrams), 0);

      return {
        ...routeOption,
        path: geometry.path,
        distanceKm,
        durationMinutes,
        carbonGrams,
        carbonSavedGrams,
        score: scoreLiveRoute(routeOption, durationMinutes, carbonGrams),
        instructions: geometry.instructions.length > 0 ? geometry.instructions : routeOption.instructions,
      };
    }),
  );

  return enhancedRoutes;
}

// Le CO2 par leg est calcule par routePlanner selon le facteur de chaque mode.
// L'enrichissement live ne recalcule pas tout au facteur du mode dominant (ce qui
// gonflerait un trajet velo+metro comme du 100 % metro) : il conserve l'intensite
// carbone moyenne de l'option d'origine (g/km) et l'applique a la distance reelle.

export function estimateLiveCarbon(routeOption: RouteOption, distanceKm: number): number {
  const baseDistanceKm = routeOption.distanceKm > 0 ? routeOption.distanceKm : distanceKm;
  const carbonIntensityPerKm = baseDistanceKm > 0 ? routeOption.carbonGrams / baseDistanceKm : 0;
  return Math.round(distanceKm * carbonIntensityPerKm);
}

export function scoreLiveRoute(routeOption: RouteOption, durationMinutes: number, carbonGrams: number): number {
  const additionalTimePenalty = Math.max(durationMinutes - routeOption.durationMinutes, 0) * 0.85;
  const additionalCarbonPenalty = Math.max(carbonGrams - routeOption.carbonGrams, 0) / 55;
  return clampScore(routeOption.score - additionalTimePenalty - additionalCarbonPenalty);
}

export function clampScore(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 100);
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export { enhanceLegsWithLiveRouting, hasCompleteGeometry } from './legs';
