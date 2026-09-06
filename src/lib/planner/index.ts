// Moteur d'itinéraires côté application : le calcul est délégué à MOTIS par le
// serveur ; ce module porte ce qui reste métier UrbanFlow — score du profil,
// classement, présélection, référence carbone et outils géographiques.
import type { MobilityProfile, RouteOption } from '../../types';
import { scoreOption } from './scoring';

/** Note chaque option pour le profil, puis classe de la plus rapide à la plus lente. */
export function rankRoutes(routes: RouteOption[], profile: MobilityProfile): RouteOption[] {
    return routes.map((option) => scoreOption(option, profile)).sort((a, b) => a.durationMinutes - b.durationMinutes);
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
export { applyCarbonReference, createCarbonReference } from './emissions';
export { midpointOfPath } from './shape';
