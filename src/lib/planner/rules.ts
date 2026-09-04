// Regles de gestion appliquees aux options produites.
import type { RouteLeg, RouteOption, RoutePreselection } from '../../types';

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
  return option.legs.filter((leg) => leg.transfer || leg.mode !== 'walk' || leg.distanceKm >= 0.05);
}

/**
 * Option retenue par defaut a l'ouverture des resultats.
 *
 * Le classement du moteur repose sur un score composite — fiabilite, carbone,
 * preferences — qui reste l'ordre d'affichage. Mais la question posee en
 * ouvrant une recherche est presque toujours « laquelle est la plus rapide »,
 * et l'utilisateur qui prefere un mode precis a une raison qui ne se deduit
 * d'aucun score. La preselection repond donc a l'une ou l'autre, sans toucher
 * ni a l'ordre ni au contenu de la liste.
 */
export function preselectRoute(routes: RouteOption[], preselection: RoutePreselection = 'fastest'): RouteOption | null {
  if (routes.length === 0) {
    return null;
  }

  const fastest = (candidates: RouteOption[]) =>
    candidates.reduce((best, option) => (option.durationMinutes < best.durationMinutes ? option : best));

  if (preselection === 'fastest') {
    return fastest(routes);
  }

  // Un mode preselectionne qui n'existe pas sur ce trajet ne doit pas laisser
  // l'utilisateur sans selection : on retombe sur la plus rapide.
  const matching = routes.filter((option) => option.modes.includes(preselection));
  return matching.length > 0 ? fastest(matching) : fastest(routes);
}
