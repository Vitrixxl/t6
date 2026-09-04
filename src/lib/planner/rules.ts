// Règles de gestion appliquées aux options produites.
import type { RouteLeg, RouteOption, RoutePreselection } from '../../types';

/**
 * Segments à montrer à l'utilisateur. Un raccord piéton de quelques mètres
 * entre deux points confondus — la station de descente et l'adresse d'arrivée,
 * par exemple — n'est pas une étape : l'afficher produit une ligne du type
 * « Gare de Vénissieux vers Gare de Vénissieux » qui n'aide personne.
 */
export function visibleLegs(option: RouteOption): RouteLeg[] {
    return option.legs.filter((leg) => leg.transfer || leg.mode !== 'walk' || leg.distanceKm >= 0.05);
}

/**
 * Option retenue par défaut à l'ouverture des résultats.
 *
 * Le classement du moteur repose sur un score composite — fiabilité, carbone,
 * préférences — qui reste l'ordre d'affichage. Mais là question posee en
 * ouvrant une recherche est presque toujours « laquelle est la plus rapide »,
 * et l'utilisateur qui préfère un mode précis à une raison qui ne se déduit
 * d'aucun score. La présélection répond donc à l'une ou l'autre, sans toucher
 * ni à l'ordre ni au contenu de la liste.
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
    // l'utilisateur sans sélection : on retombe sur la plus rapide.
    const matching = routes.filter((option) => option.modes.includes(preselection));
    return matching.length > 0 ? fastest(matching) : fastest(routes);
}
