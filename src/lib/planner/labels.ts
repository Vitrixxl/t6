// Libellés affiches. `routeLabel` nomme la ligne exactement ("Métro B",
// "Tram T1") : depuis l'intégration de la desserte publiée, une ligne n'est
// proposée que si elle dessert réellement les deux stations du segment.
import type { GtfsRoute, MobilityMode } from '../../types';

export const MODE_LABELS: Record<MobilityMode, string> = {
    walk: 'marche',
    bike: 'velo',
    scooter: 'trottinette',
    transit: 'transport public',
};

const ROUTE_KIND: Record<number, string> = {
    0: 'Tram',
    1: 'Métro',
    7: 'Funiculaire',
};

export function routeLabel(route: GtfsRoute): string {
    const kind = ROUTE_KIND[route.route_type] ?? 'Ligne';
    return route.route_short_name ? `${kind} ${route.route_short_name}` : kind;
}
