// Moteur d'itineraires : produit les options multimodales candidates, puis les
// classe selon le profil de l'utilisateur.
//
// Chaque mode a son generateur dans options/ ; ce fichier ne fait que les
// appeler et trier le resultat. Ajouter un mode revient donc a ajouter un
// fichier, sans toucher a la logique de classement.
import type { MobilityProfile, RouteLeg, RouteOption, RouteRequest } from '../../types';
import { estimateRouteAccessPlan, type RouteAccessPlan } from './access';
import { haversineDistanceKm } from './geo';
import { createBikeOption } from './options/bike';
import { createBikeTransitOption } from './options/bike-transit';
import { createScooterOption } from './options/scooter';
import { createScooterTransitOption } from './options/scooter-transit';
import { createTransitOption } from './options/transit';
import { createWalkOption } from './options/walk';
import { applyRoutedLegs } from './legs';
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
        createBikeTransitOption(request, directKm, access.bikeTransit),
        createScooterTransitOption(request, directKm, access.scooterTransit),
        createBikeOption(request, directKm, access.bike),
        createScooterOption(request, directKm, access.scooter),
        createWalkOption(request, directKm),
    ].filter((option): option is RouteOption => Boolean(option));

    return rankRoutes(candidates, request.profile);
}

/**
 * Note et classe les options. Extrait de `planRoutes` parce que le classement
 * doit etre refait apres mesure : le score depend de la duree et du carbone,
 * qui changent quand la voirie remplace le vol d'oiseau.
 */
export function rankRoutes(routes: RouteOption[], profile: MobilityProfile): RouteOption[] {
    return routes.map((option) => scoreOption(option, profile)).sort((a, b) => b.score - a.score);
}

/**
 * Mesure toutes les options par le service de routage, puis les reclasse.
 *
 * Les distances a vol d'oiseau ne servent qu'a construire les segments avant
 * leur mesure. Ces chiffres ne doivent pas atteindre l'interface : une liste ou
 * une ligne mesuree et les autres estimees ne sont pas comparables (B20).
 */
export async function measureRoutes(
    routes: RouteOption[],
    profile: MobilityProfile,
    measure: (legs: RouteLeg[]) => Promise<RouteLeg[]>,
): Promise<RouteOption[]> {
    const measured = await Promise.all(
        routes.map(async (option) => applyRoutedLegs(option, await measure(option.legs))),
    );

    // Une option dont un segment n'a pas de trace n'a pas de mesure : l'afficher
    // supposerait de retomber sur son estimation, donc de remettre deux methodes
    // dans la meme liste.
    return rankRoutes(
        measured.filter((option) =>
            option.legs.length > 0 && option.legs.every((leg) => leg.transfer || leg.path.length >= 2),
        ),
        profile,
    );
}

export { haversineDistanceKm } from './geo';
export { LANDMARKS } from './constants';
export { SCORING_WEIGHTS } from './scoring';
export { preselectRoute, totalWalkMinutes, visibleLegs } from './rules';
export {
    findNearby,
    findWithinRadius,
    formatDistance,
    walkMinutes,
    type Nearby,
    type NearbyWithin,
} from './nearby';
export { applyRoutedLegs } from './legs';
export { midpointOfPath } from './shape';
export { prepareRoutedAccessPlan, type RouteAccessPlan, type RouteMatrixMeasurer } from './access';
