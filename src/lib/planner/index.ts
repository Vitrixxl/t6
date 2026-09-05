// Moteur d'itinéraires : produit les options multimodales candidates, puis les
// classe de la plus rapide à la plus lente.
//
// Les générateurs vivent dans options/ ; vélo + transport et trottinette +
// transport partagent le même parcours dans feeder-transit.ts. Ce fichier
// assemble les six familles puis classe les options calculables.
import type { MobilityProfile, RouteLeg, RouteOption, RouteRequest } from '../../types';
import { estimateRouteAccessPlan, type RouteAccessPlan } from './access';
import { haversineDistanceKm } from './geo';
import { createBikeOption } from './options/bike';
import { createFeederTransitOption } from './options/feeder-transit';
import { createScooterOption } from './options/scooter';
import { createTransitOption } from './options/transit';
import { createWalkOption } from './options/walk';
import { applyRoutedLegs, hasCompleteGeometry } from './legs';
import { scoreOption } from './scoring';

export function planRoutes(
    request: RouteRequest,
    access: RouteAccessPlan = estimateRouteAccessPlan({
        origin: request.origin,
        destination: request.destination,
        network: request.network,
        requireAccessible: request.profile.accessibilityNeed,
    }),
): RouteOption[] {
    const directKm = Math.max(haversineDistanceKm(request.origin, request.destination), 0.15);
    const candidates = [
        createTransitOption(request, access.transit),
        createFeederTransitOption(request, directKm, 'bike', access.bikeTransit),
        createFeederTransitOption(request, directKm, 'scooter', access.scooterTransit),
        createBikeOption(request, directKm, access.bike),
        createScooterOption(request, directKm, access.scooter),
        createWalkOption(request, directKm),
    ].filter((option): option is RouteOption => Boolean(option));

    return rankRoutes(candidates, request.profile);
}

/**
 * Note et classe les options. Extrait de `planRoutes` parce que le classement
 * doit être refait après mesure : les durées réelles déterminent l’ordre
 * affiché. Le score du profil reste une information associée à chaque option.
 */
export function rankRoutes(routes: RouteOption[], profile: MobilityProfile): RouteOption[] {
    return routes.map((option) => scoreOption(option, profile)).sort((a, b) => a.durationMinutes - b.durationMinutes);
}

/**
 * Mesure toutes les options par le service de routage, puis les reclasse.
 *
 * Les distances à vol d'oiseau ne servent qu'a construire les segments avant
 * leur mesure. Ces chiffres ne doivent pas atteindre l'interface : une liste ou
 * une ligne mesurée et les autres estimées ne sont pas comparables (B20).
 */
export async function measureRoutes(
    routes: RouteOption[],
    profile: MobilityProfile,
    measure: (legs: RouteLeg[]) => Promise<RouteLeg[]>,
): Promise<RouteOption[]> {
    const measured = await Promise.all(
        routes.map(async (option) => applyRoutedLegs(option, await measure(option.legs))),
    );

    // Une option dont un segment n'a pas de tracé n'a pas de mesure : l'afficher
    // supposerait de retomber sur son estimation, donc de remettre deux méthodes
    // dans la même liste.
    return rankRoutes(
        measured.filter((option) => hasCompleteGeometry(option.legs)),
        profile,
    );
}

export { haversineDistanceKm } from './geo';
export { LANDMARKS } from './constants';
export { SCORING_WEIGHTS } from './scoring';
export { preselectRoute, visibleLegs } from './rules';
export {
    findNearby,
    findWithinRadius,
    formatDistance,
    walkMinutes,
    type Nearby,
    type NearbyWithin,
} from './nearby';
export { applyRoutedLegs, hasCompleteGeometry } from './legs';
export { applyCarbonReference, createCarbonReference } from './emissions';
export { midpointOfPath } from './shape';
export { prepareRoutedAccessPlan, type RouteAccessPlan, type RouteMatrixMeasurer } from './access';
