// Calcul des itineraires : options locales, puis geometrie reelle par le
// service de routage.
//
// Le moteur local produit toujours la liste des options et leurs estimations,
// meme hors ligne. En revanche il ne produit **aucun trace** pour ce qui
// emprunte la voirie : la geometrie vient du routage, ou elle n'existe pas.
// D'ou le statut ci-dessous, que l'interface affiche pour dire si la carte est
// en train de se remplir, ou si elle ne pourra pas l'etre.
import { useEffect, useMemo, useState } from 'react';
import type { GeoPoint, MobilityMode, MobilityProfile, RouteLeg, RouteOption, TransportNetwork } from '../../../types';
import { matchesEnabledModes, planRoutes } from '../../../lib/planner';
import { enhanceLegsWithLiveRouting, enhanceRoutesWithLiveRouting, hasCompleteGeometry } from '../../../lib/transport';

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
  enabledModes: MobilityMode[];
}): RouteOptions {
  const { origin, destination, profile, network, enabledModes } = input;
  const [liveRoutes, setLiveRoutes] = useState<RouteOption[]>([]);
  const [routingStatus, setRoutingStatus] = useState<RoutingStatus>('idle');
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedLegs, setSelectedLegs] = useState<RouteLeg[]>([]);

  const localRoutes = useMemo(
    () => (origin && destination ? planRoutes({ origin, destination, profile, network }) : []),
    [destination, network, origin, profile],
  );

  const candidateRoutes = liveRoutes.length > 0 ? liveRoutes : localRoutes;
  const routes = candidateRoutes.filter((routeOption) => matchesEnabledModes(routeOption, enabledModes));
  const selectedRoute = routes.find((routeOption) => routeOption.id === selectedRouteId) ?? routes[0] ?? null;

  useEffect(() => {
    if (!origin || !destination) {
      setLiveRoutes([]);
      return;
    }

    const controller = new AbortController();
    enhanceRoutesWithLiveRouting(localRoutes, origin, destination, controller.signal)
      .then(setLiveRoutes)
      .catch(() => setLiveRoutes([]));

    return () => controller.abort();
  }, [destination, localRoutes, origin]);

  useEffect(() => {
    if (!selectedRoute || selectedRoute.id === selectedRouteId) {
      return;
    }
    setSelectedRouteId(selectedRoute.id);
  }, [selectedRoute, selectedRouteId]);

  // Seul l'itineraire affiche est route segment par segment : trois a quatre
  // appels au changement de selection, plutot que pour chacune des options.
  useEffect(() => {
    if (!selectedRoute) {
      setSelectedLegs([]);
      setRoutingStatus('idle');
      return;
    }

    // Les segments sont d'abord poses sans geometrie : la carte n'affiche donc
    // rien de ce trajet tant que le routage n'a pas repondu, et l'interface
    // annonce un calcul en cours.
    setSelectedLegs(selectedRoute.legs);
    setRoutingStatus('pending');

    const controller = new AbortController();
    enhanceLegsWithLiveRouting(selectedRoute.legs, controller.signal)
      .then((legs) => {
        setSelectedLegs(legs);
        setRoutingStatus(hasCompleteGeometry(legs) ? 'ready' : 'unavailable');
      })
      .catch(() => setRoutingStatus('unavailable'));

    return () => controller.abort();
  }, [selectedRoute]);

  return { routes, selectedRoute, selectedLegs, selectedRouteId, setSelectedRouteId, routingStatus };
}
