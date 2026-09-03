// Moteur d'itineraires : produit les options multimodales candidates, puis les
// classe selon le profil de l'utilisateur.
//
// Chaque mode a son generateur dans options/ ; ce fichier ne fait que les
// appeler et trier le resultat. Ajouter un mode revient donc a ajouter un
// fichier, sans toucher a la logique de classement.
import type { MobilityProfile, RouteLeg, RouteOption, RouteRequest } from '../../types';
import { haversineDistanceKm } from './geo';
import { createBikeOption } from './options/bike';
import { createBikeTransitOption } from './options/bike-transit';
import { createScooterOption } from './options/scooter';
import { createTransitOption } from './options/transit';
import { createWalkOption } from './options/walk';
import { applyRoutedLegs } from './legs';
import { scoreOption } from './scoring';

export function planRoutes(request: RouteRequest): RouteOption[] {
    const directKm = Math.max(haversineDistanceKm(request.origin, request.destination), 0.15);
    const candidates = [
        createTransitOption(request),
        createBikeTransitOption(request, directKm),
        createBikeOption(request, directKm),
        createScooterOption(request, directKm),
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
 * Le moteur local calcule a vol d'oiseau pour savoir quelles options existent.
 * Ces chiffres ne doivent pas atteindre l'interface : une liste ou une ligne est
 * mesuree et les autres estimees n'est pas comparable, et changer de selection
 * changeait les valeurs affichees (B20).
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
        measured.filter((option) => option.legs.length > 0 && option.legs.every((leg) => leg.path.length >= 2)),
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
