// Les résultats restent dans React Query ; seul le choix de l'utilisateur vit
// dans l'état d'écran. La première arrivée est sélectionnée par défaut.
import { useMemo } from 'react';
import { hashKey, useQuery } from '@tanstack/react-query';
import type { GeoPoint, MobilityProfile, RouteOption, TransportContext } from '../../../types';
import { routeOptionsQuery, type RouteSearch } from '../../../queries';
import { useSearchFilters } from '../../planner/useSearchFilters';
import { useRouteSelection } from '../../planner/useRouteSelection';

const NO_OPTIONS: RouteOption[] = [];

/**
 * État du tracé. `pending` et `unavailable` sont deux choses différentes pour
 * l'utilisateur : dans le premier cas la carte va se remplir, dans le second
 * il faut lui dire que le service de routage ne répond pas.
 */
export type RoutingStatus = 'idle' | 'pending' | 'ready' | 'partial' | 'unavailable';

export const ROUTING_STATUS_LABEL: Record<RoutingStatus, string> = {
    idle: 'En attente d\'un trajet',
    pending: 'Calcul du tracé en cours',
    ready: 'Tracé réel affiché',
    partial: 'Une partie du tracé est indisponible',
    unavailable: 'Service de routage indisponible',
};

export function useRouteOptions(input: {
    origin: GeoPoint | null;
    destination: GeoPoint | null;
    profile: MobilityProfile;
    network: TransportContext;
}) {
    const { origin, destination, profile, network } = input;
    const { filters } = useSearchFilters();

    const search = useMemo<RouteSearch | null>(
        () => (origin && destination ? { origin, destination, filters, accessibilityNeed: profile.accessibilityNeed } : null),
        [destination, filters, origin, profile.accessibilityNeed],
    );
    // Changer d'extrémités ou de filtres annule la requête en vol : le trajet
    // affiché est toujours celui de la recherche courante.
    const request = routeOptionsQuery(search, network);
    const query = useQuery(request);
    const options = query.data ?? NO_OPTIONS;
    const queryKey = hashKey(request.queryKey);
    const { route } = useRouteSelection(options, queryKey);
    const routeStatus: RoutingStatus = !route ? 'unavailable' : route.legs.some(leg => leg.path.length < 2) ? 'partial' : 'ready';
    const routingStatus: RoutingStatus = !search ? 'idle' : query.isPending ? 'pending' : routeStatus;

    return { route, options, queryKey, routingStatus };
}
