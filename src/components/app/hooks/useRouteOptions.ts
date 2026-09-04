// Calcul des itineraires : OSRM classe d'abord les acces possibles, le moteur
// assemble les options, puis OSRM mesure tous leurs segments de voirie.
//
// **Aucune estimation n'atteint l'interface.** Le calcul local sert uniquement
// a savoir quelles options existent ; ses chiffres restent dans la requete.
// Toutes les options sont mesurees, puis affichees ensemble.
//
// C'est le prix d'une liste comparable. Ne mesurer que l'option selectionnee
// coutait trois appels au lieu d'une quinzaine, mais melangeait deux methodes
// dans le meme tableau : changer de selection changeait les chiffres (B20). Le
// surcout est absorbe par le cache partage de l'API.
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GeoPoint, MobilityProfile, RouteLeg, RouteOption, TransportNetwork } from '../../../types';
import { preselectRoute } from '../../../lib/planner';
import { measuredRoutesQuery, type RouteSearch } from '../../../queries';

/**
 * Etat du trace. `pending` et `unavailable` sont deux choses differentes pour
 * l'utilisateur : dans le premier cas la carte va se remplir, dans le second
 * il faut lui dire que le service de routage ne repond pas.
 */
export type RoutingStatus = 'idle' | 'pending' | 'ready' | 'unavailable';

export const ROUTING_STATUS_LABEL: Record<RoutingStatus, string> = {
    idle: 'En attente d\'un trajet',
    pending: 'Calcul du trace en cours',
    ready: 'Trace reel affiche',
    unavailable: 'Service de routage indisponible',
};

export interface RouteOptions {
    routes: RouteOption[];
    selectedRoute: RouteOption | null;
    /**
     * Segments de l'itineraire selectionne, routes individuellement pour que la
     * carte puisse colorer chaque mode sur sa geometrie reelle.
     */
    selectedLegs: RouteLeg[];
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
    // La selection des acces et la mesure forment une seule requete : changer
    // d'extremites l'annule, et la liste se vide pendant le nouveau calcul.
    const measured = useQuery(measuredRoutesQuery(search, network));
    const routes = measured.data ?? NO_ROUTES;
    const routingStatus: RoutingStatus =
        !search ? 'idle' : measured.isPending ? 'pending' : routes.length > 0 ? 'ready' : 'unavailable';

    // La selection manuelle vaut pour la recherche en cours ; une nouvelle
    // recherche repart de la preselection du profil, sans quoi le choix fait sur
    // un trajet precedent se propagerait a tous les suivants.
    const selectedRoute =
        routes.find((routeOption) => routeOption.id === selectedRouteId) ??
        preselectRoute(routes, profile.routePreselection);

    const selectedLegs = selectedRoute?.legs ?? [];

    useEffect(() => {
        setSelectedRouteId('');
    }, [destination, origin]);

    useEffect(() => {
        if (!selectedRoute || selectedRoute.id === selectedRouteId) {
            return;
        }
        setSelectedRouteId(selectedRoute.id);
    }, [selectedRoute, selectedRouteId]);

    return { routes, selectedRoute, selectedLegs, selectedRouteId, setSelectedRouteId, routingStatus };
}
