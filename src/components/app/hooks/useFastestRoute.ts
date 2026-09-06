// Calcul du trajet : le serveur interroge MOTIS avec les moyens de la recherche
// et rend le trajet qui arrive le premier, mesuré et tracé.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GeoPoint, MobilityProfile, RouteOption, TransportContext } from '../../../types';
import { fastestRouteQuery, type RouteSearch } from '../../../queries';
import { useSearchFilters } from '../../planner/useSearchFilters';

/**
 * État du tracé. `pending` et `unavailable` sont deux choses différentes pour
 * l'utilisateur : dans le premier cas la carte va se remplir, dans le second
 * il faut lui dire que le service de routage ne répond pas.
 */
export type RoutingStatus = 'idle' | 'pending' | 'ready' | 'unavailable';

export const ROUTING_STATUS_LABEL: Record<RoutingStatus, string> = {
    idle: 'En attente d\'un trajet',
    pending: 'Calcul du tracé en cours',
    ready: 'Tracé réel affiché',
    unavailable: 'Service de routage indisponible',
};

export function useFastestRoute(input: {
    origin: GeoPoint | null;
    destination: GeoPoint | null;
    profile: MobilityProfile;
    network: TransportContext;
}): { route: RouteOption | null; routingStatus: RoutingStatus } {
    const { origin, destination, profile, network } = input;
    const { filters } = useSearchFilters();

    const search = useMemo<RouteSearch | null>(
        () => (origin && destination ? { origin, destination, filters, accessibilityNeed: profile.accessibilityNeed } : null),
        [destination, filters, origin, profile.accessibilityNeed],
    );
    // Changer d'extrémités ou de filtres annule la requête en vol : le trajet
    // affiché est toujours celui de la recherche courante.
    const query = useQuery(fastestRouteQuery(search, network));
    const route = query.data ?? null;
    const routingStatus: RoutingStatus = !search ? 'idle' : query.isPending ? 'pending' : route ? 'ready' : 'unavailable';

    return { route, routingStatus };
}
