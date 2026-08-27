// Itineraires enregistres par l'utilisateur.
//
// L'etat local et les mutations vivent ensemble : l'interface n'a pas a savoir
// que l'enregistrement passe par le cache local puis par la file de
// synchronisation.
import { useState } from 'react';
import type { GeoPoint, RouteOption, SavedRouteRecord } from '../../../types';
import { createSavedRouteRecord, deleteSavedRouteRecord, loadSavedRoutes, saveSavedRouteRecord } from '../../../lib/savedRoutes';

/** Duree du retour visuel "enregistre" sur le bouton. */
const CONFIRMATION_MS = 1800;

export interface SavedRoutes {
  savedRoutes: SavedRouteRecord[];
  /** Identifiant de l'itineraire venant d'etre enregistre, pour le retour visuel. */
  justSavedRouteId: string;
  saveRoute: (routeOption: RouteOption, origin: GeoPoint, destination: GeoPoint) => void;
  deleteSavedRoute: (recordId: string) => void;
}

export function useSavedRoutes(userId: string): SavedRoutes {
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteRecord[]>(() => loadSavedRoutes(userId));
  const [justSavedRouteId, setJustSavedRouteId] = useState('');

  return {
    savedRoutes,
    justSavedRouteId,
    saveRoute(routeOption, origin, destination) {
      setSavedRoutes(saveSavedRouteRecord(createSavedRouteRecord(userId, origin, destination, routeOption)));
      setJustSavedRouteId(routeOption.id);
      window.setTimeout(() => setJustSavedRouteId(''), CONFIRMATION_MS);
    },
    deleteSavedRoute(recordId) {
      setSavedRoutes(deleteSavedRouteRecord(userId, recordId));
    },
  };
}
