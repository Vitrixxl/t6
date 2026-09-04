// Calcul des itinéraires : OSRM classe d'abord les accès possibles, le moteur
// assemble les options, puis OSRM mesure tous leurs segments de voirie.
//
// **Aucune estimation n'atteint l'interface.** Le calcul local sert uniquement
// à savoir quelles options existent ; ses chiffres restent dans la requête.
// Toutes les options sont mesurées, puis affichées ensemble.
//
// C'est le prix d'une liste comparable. Ne mesurer que l'option sélectionnée
// coutait trois appels au lieu d'une quinzaine, mais melangeait deux méthodes
// dans le même tableau : changer de sélection changeait les chiffres (B20). Le
// surcoût est absorbe par le cache partagé de l'API.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GeoPoint, MobilityProfile, RouteOption, TransportNetwork } from '../../../types';
import { preselectRoute } from '../../../lib/planner';
import { measuredRoutesQuery, type RouteSearch } from '../../../queries';

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

export interface RouteOptions {
    routes: RouteOption[];
    selectedRoute: RouteOption | null;
    selectedRouteId: string;
    setSelectedRouteId: (id: string) => void;
    routingStatus: RoutingStatus;
}

const NO_ROUTES: RouteOption[] = [];

export function useRouteOptions(input: {
    origin: GeoPoint | null;
    destination: GeoPoint | null;
    profile: MobilityProfile;
    network: TransportNetwork;
}): RouteOptions {
    const { origin, destination, profile, network } = input;
    const [selectedRouteId, setSelectedRouteId] = useState('');

    const search = useMemo<RouteSearch | null>(
        () => (origin && destination ? { origin, destination, profile } : null),
        [destination, origin, profile],
    );
    // La sélection des accès et la mesure forment une seule requête : changer
    // d'extrémités l'annule, et la liste se vide pendant le nouveau calcul.
    const measured = useQuery(measuredRoutesQuery(search, network));
    const routes = measured.data ?? NO_ROUTES;
    const routingStatus: RoutingStatus =
        !search ? 'idle' : measured.isPending ? 'pending' : routes.length > 0 ? 'ready' : 'unavailable';

    // La sélection manuelle vaut pour la recherche en cours ; une nouvelle
    // recherche repart de la présélection du profil, sans quoi le choix fait sur
    // un trajet précédent se propagerait à tous les suivants.
    const selectedRoute =
        routes.find((routeOption) => routeOption.id === selectedRouteId) ??
        preselectRoute(routes, profile.routePreselection);

    useEffect(() => {
        setSelectedRouteId('');
    }, [destination, origin]);

    useEffect(() => {
        if (!selectedRoute || selectedRoute.id === selectedRouteId) {
            return;
        }
        setSelectedRouteId(selectedRoute.id);
    }, [selectedRoute, selectedRouteId]);

    return { routes, selectedRoute, selectedRouteId, setSelectedRouteId, routingStatus };
}
