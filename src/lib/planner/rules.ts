// Regles de gestion appliquees aux options produites.
import type { RouteLeg, RouteOption } from '../../types';

export function totalWalkMinutes(option: RouteOption): number {
  return option.legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + leg.durationMinutes, 0);
}

/**
 * Segments a montrer a l'utilisateur. Un raccord pieton de quelques metres
 * entre deux points confondus — la station de descente et l'adresse d'arrivee,
 * par exemple — n'est pas une etape : l'afficher produit une ligne du type
 * « Gare de Venissieux vers Gare de Venissieux » qui n'aide personne.
 */
export function visibleLegs(option: RouteOption): RouteLeg[] {
  return option.legs.filter((leg) => leg.mode !== 'walk' || leg.distanceKm >= 0.05);
}
