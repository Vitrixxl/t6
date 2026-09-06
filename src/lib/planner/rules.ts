// Règles de gestion appliquées au trajet produit.
import type { RouteLeg, RouteOption } from '../../types';

/**
 * Segments à montrer à l'utilisateur. Un raccord piéton de quelques mètres
 * entre deux points confondus — la station de descente et l'adresse d'arrivée,
 * par exemple — n'est pas une étape : l'afficher produit une ligne du type
 * « Gare de Vénissieux vers Gare de Vénissieux » qui n'aide personne.
 */
export function visibleLegs(option: RouteOption): RouteLeg[] {
    return option.legs.filter((leg) => leg.transfer || leg.mode !== 'walk' || leg.distanceKm >= 0.05);
}
