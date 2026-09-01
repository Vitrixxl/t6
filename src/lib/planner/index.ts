// Moteur d'itineraires : produit les options multimodales candidates, puis les
// classe selon le profil de l'utilisateur.
//
// Chaque mode a son generateur dans options/ ; ce fichier ne fait que les
// appeler et trier le resultat. Ajouter un mode revient donc a ajouter un
// fichier, sans toucher a la logique de classement.
import type { RouteOption, RouteRequest } from '../../types';
import { haversineDistanceKm } from './geo';
import { createBikeOption } from './options/bike';
import { createBikeTransitOption } from './options/bike-transit';
import { createCarpoolOption } from './options/carpool';
import { createScooterOption } from './options/scooter';
import { createTransitOption } from './options/transit';
import { createWalkOption } from './options/walk';
import { scoreOption } from './scoring';

export function planRoutes(request: RouteRequest): RouteOption[] {
  const directKm = Math.max(haversineDistanceKm(request.origin, request.destination), 0.15);
  const candidates = [
    createTransitOption(request),
    createBikeTransitOption(request, directKm),
    createBikeOption(request, directKm),
    createScooterOption(request, directKm),
    createCarpoolOption(request, directKm),
    createWalkOption(request, directKm),
  ].filter((option): option is RouteOption => Boolean(option));

  return candidates
    .map((option) => scoreOption(option, request.profile))
    .sort((a, b) => b.score - a.score);
}

export { haversineDistanceKm } from './geo';
export { LANDMARKS, DEFAULT_CARPOOL_OCCUPANTS, MIN_CARPOOL_OCCUPANTS, MAX_CARPOOL_OCCUPANTS } from './constants';
export { SCORING_WEIGHTS } from './scoring';
export { totalWalkMinutes } from './rules';
export { findNearby, formatDistance, walkMinutes, type Nearby } from './nearby';
export { applyRoutedLegs } from './legs';
