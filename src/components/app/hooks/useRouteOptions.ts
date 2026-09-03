// Calcul des itineraires : le moteur local propose les options, le service de
// routage les mesure.
//
// **Aucune estimation n'atteint l'interface.** Le calcul local sert uniquement
// a savoir quelles options existent ; ses chiffres restent dans le hook. Toutes
// les options sont mesurees, puis affichees ensemble.
//
// C'est le prix d'une liste comparable. Ne mesurer que l'option selectionnee
// coutait trois appels au lieu d'une quinzaine, mais melangeait deux methodes
// dans le meme tableau : changer de selection changeait les chiffres (B20). Le
// surcout est absorbe par le cache partage de l'API.
import { useEffect, useMemo, useState } from 'react';
import type { GeoPoint, MobilityProfile, RouteLeg, RouteOption, TransportNetwork } from '../../../types';
import { measureRoutes, planRoutes, preselectRoute } from '../../../lib/planner';
import { enhanceLegsWithLiveRouting } from '../../../lib/transport';

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

export function useRouteOptions(input: {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  profile: MobilityProfile;
  network: TransportNetwork;
}): RouteOptions {
  const { origin, destination, profile, network } = input;
  const [routingStatus, setRoutingStatus] = useState<RoutingStatus>('idle');
  const [selectedRouteId, setSelectedRouteId] = useState('');

  const [routes, setRoutes] = useState<RouteOption[]>([]);

  const localRoutes = useMemo(
    () => (origin && destination ? planRoutes({ origin, destination, profile, network }) : []),
    [destination, network, origin, profile],
  );

  useEffect(() => {
    if (localRoutes.length === 0) {
      setRoutes([]);
      setRoutingStatus('idle');
      return;
    }

    // La liste se vide pendant la mesure : afficher les estimations en attendant
    // reviendrait a montrer des chiffres qui vont changer sous les yeux.
    setRoutes([]);
    setRoutingStatus('pending');

    const controller = new AbortController();
    measureRoutes(localRoutes, profile, (legs) => enhanceLegsWithLiveRouting(legs, controller.signal))
      .then((measured) => {
        if (controller.signal.aborted) {
          return;
        }
        setRoutes(measured);
        setRoutingStatus(measured.length > 0 ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRoutingStatus('unavailable');
        }
      });

    return () => controller.abort();
  }, [localRoutes, profile]);

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
