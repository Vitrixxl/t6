// Calcul des itineraires : options locales, puis geometrie reelle par le
// service de routage.
//
// Le moteur local produit toujours la liste des options et leurs estimations,
// meme hors ligne. En revanche il ne produit **aucun trace** pour ce qui
// emprunte la voirie : la geometrie vient du routage, ou elle n'existe pas.
// D'ou le statut ci-dessous, que l'interface affiche pour dire si la carte est
// en train de se remplir, ou si elle ne pourra pas l'etre.
import { useEffect, useMemo, useState } from 'react';
import type { GeoPoint, MobilityProfile, RouteLeg, RouteOption, TransportNetwork } from '../../../types';
import { applyRoutedLegs, planRoutes, preselectRoute } from '../../../lib/planner';
import { enhanceLegsWithLiveRouting, hasCompleteGeometry } from '../../../lib/transport';

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
  const [selectedLegs, setSelectedLegs] = useState<RouteLeg[]>([]);

  const localRoutes = useMemo(
    () => (origin && destination ? planRoutes({ origin, destination, profile, network }) : []),
    [destination, network, origin, profile],
  );

  // Toutes les options calculables sont proposees. Un generateur qui ne peut
  // rien produire — pas de station a portee, aucune ligne reliant les deux
  // points — ne renvoie deja rien : filtrer en plus revenait a masquer des
  // trajets valables sans jamais dire pourquoi.
  const routes = localRoutes;
  // La selection manuelle vaut pour la recherche en cours ; une nouvelle
  // recherche repart de la preselection du profil, sans quoi le choix fait sur
  // un trajet precedent se propagerait a tous les suivants.
  const candidate =
    routes.find((routeOption) => routeOption.id === selectedRouteId) ??
    preselectRoute(routes, profile.routePreselection);

  // Les mesures de l'option affichee suivent celles de ses segments une fois
  // routes : l'entete et le detail ne peuvent pas annoncer deux chiffres
  // differents pour le meme trajet.
  const selectedRoute = useMemo(
    () => (candidate && routingStatus === 'ready' ? applyRoutedLegs(candidate, selectedLegs) : candidate),
    [candidate, routingStatus, selectedLegs],
  );

  // Un changement de trajet efface la selection manuelle. Declare avant
  // l'effet qui la repositionne, pour que la preselection s'applique au meme
  // rendu plutot qu'au suivant.
  useEffect(() => {
    setSelectedRouteId('');
  }, [destination, origin]);

  useEffect(() => {
    if (!candidate || candidate.id === selectedRouteId) {
      return;
    }
    setSelectedRouteId(candidate.id);
  }, [candidate, selectedRouteId]);

  // Seul l'itineraire affiche est route segment par segment : trois a quatre
  // appels au changement de selection, plutot que pour chacune des options.
  useEffect(() => {
    if (!candidate) {
      setSelectedLegs([]);
      setRoutingStatus('idle');
      return;
    }

    // Les segments sont d'abord poses sans geometrie : la carte n'affiche donc
    // rien de ce trajet tant que le routage n'a pas repondu, et l'interface
    // annonce un calcul en cours.
    setSelectedLegs(candidate.legs);
    setRoutingStatus('pending');

    const controller = new AbortController();
    enhanceLegsWithLiveRouting(candidate.legs, controller.signal)
      .then((legs) => {
        setSelectedLegs(legs);
        setRoutingStatus(hasCompleteGeometry(legs) ? 'ready' : 'unavailable');
      })
      .catch(() => setRoutingStatus('unavailable'));

    return () => controller.abort();
  }, [candidate]);

  return { routes, selectedRoute, selectedLegs, selectedRouteId, setSelectedRouteId, routingStatus };
}
