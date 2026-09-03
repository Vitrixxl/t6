// Itineraires enregistres par l'utilisateur, sur l'etat du compte.
import { useState } from 'react';
import type { GeoPoint, RouteOption, SavedRouteRecord } from '../../../types';
import { addSavedRoute, createSavedRouteRecord, removeSavedRoute } from '../../../lib/savedRoutes';
import type { Account } from './useAccount';

/** Duree du retour visuel "enregistre" sur le bouton. */
const CONFIRMATION_MS = 1800;

export interface SavedRoutes {
  savedRoutes: SavedRouteRecord[];
  /** Identifiant de l'itineraire venant d'etre enregistre, pour le retour visuel. */
  justSavedRouteId: string;
  saveRoute: (routeOption: RouteOption, origin: GeoPoint, destination: GeoPoint) => void;
  deleteSavedRoute: (recordId: string) => void;
}

export function useSavedRoutes(account: Account): SavedRoutes {
  const [justSavedRouteId, setJustSavedRouteId] = useState('');

  return {
    savedRoutes: account.state.savedRoutes,
    justSavedRouteId,
    saveRoute(routeOption, origin, destination) {
      const record = createSavedRouteRecord(account.user.id, origin, destination, routeOption);
      account.update((state) => ({ ...state, savedRoutes: addSavedRoute(state.savedRoutes, record) }));
      setJustSavedRouteId(routeOption.id);
      window.setTimeout(() => setJustSavedRouteId(''), CONFIRMATION_MS);
    },
    deleteSavedRoute(recordId) {
      account.update((state) => ({ ...state, savedRoutes: removeSavedRoute(state.savedRoutes, recordId) }));
    },
  };
}
