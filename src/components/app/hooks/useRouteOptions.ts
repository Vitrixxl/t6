// Calcul des itineraires : options locales, puis enrichissement par le routage
// reel quand il repond.
//
// Le moteur local produit toujours un resultat, meme hors ligne ; OSRM ne fait
// que remplacer la geometrie et les mesures. L'utilisateur voit donc toujours
// des options, et le statut affiche lui dit laquelle des deux sources il
// regarde.
import { useEffect, useMemo, useState } from 'react';
import type { GeoPoint, MobilityMode, MobilityProfile, RouteOption, TransportNetwork } from '../../../types';
import { matchesEnabledModes, planRoutes } from '../../../lib/planner';
import { enhanceRoutesWithLiveRouting } from '../../../lib/transport';

export interface RouteOptions {
  routes: RouteOption[];
  selectedRoute: RouteOption | null;
  selectedRouteId: string;
  setSelectedRouteId: (id: string) => void;
  /** Etat du routage live, affiche tel quel dans l'interface. */
  routingApiStatus: string;
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
  const [routingApiStatus, setRoutingApiStatus] = useState('En attente');
  const [selectedRouteId, setSelectedRouteId] = useState('');

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
      setRoutingApiStatus('En attente');
      return;
    }

    const controller = new AbortController();
    setRoutingApiStatus('Calcul OSRM en cours');
    enhanceRoutesWithLiveRouting(localRoutes, origin, destination, controller.signal)
      .then((enhancedRoutes) => {
        setLiveRoutes(enhancedRoutes);
        const hasLiveGeometry = enhancedRoutes.some((routeOption, index) => routeOption.path !== localRoutes[index]?.path);
        setRoutingApiStatus(hasLiveGeometry ? 'Trace OSRM active' : 'Trace locale');
      })
      .catch(() => {
        // Repli assume : la geometrie locale reste affichee (C10).
        setLiveRoutes(localRoutes);
        setRoutingApiStatus('Trace locale');
      });

    return () => controller.abort();
  }, [destination, localRoutes, origin]);

  useEffect(() => {
    if (!selectedRoute || selectedRoute.id === selectedRouteId) {
      return;
    }
    setSelectedRouteId(selectedRoute.id);
  }, [selectedRoute, selectedRouteId]);

  return { routes, selectedRoute, selectedRouteId, setSelectedRouteId, routingApiStatus };
}
