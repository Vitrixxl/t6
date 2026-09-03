// Etat du compte cote client : hydratation du cache local depuis le serveur,
// et lecture du cache local pour l'envoyer.
//
// Les caches locaux restent la seule source lue par l'interface : le serveur
// ne parle jamais directement aux composants. Cette indirection est ce qui
// garde l'application utilisable pendant une coupure reseau.
import type {
  MobilityProfile,
  PlannedTrip,
  RecurringTrip,
  SavedRouteRecord,
  SessionUser,
  TripRecord,
} from '../../types';
import { loadTripHistory, replaceTripHistory } from '../carbon';
import { loadPlannedTrips, loadRecurringTrips, replacePlannedTrips, replaceRecurringTrips } from '../trips';
import { loadSavedRoutes, replaceSavedRoutes } from '../savedRoutes';

/** Etat complet d'un compte, tel que le serveur le renvoie. */
export interface RemoteState {
  profile: MobilityProfile;
  tripRecords: TripRecord[];
  plannedTrips: PlannedTrip[];
  recurringTrips: RecurringTrip[];
  savedRoutes: SavedRouteRecord[];
}

/** Etat tel que le client l'envoie : le proprietaire est deduit de la session. */
export interface LocalState {
  profile: MobilityProfile;
  tripRecords: Omit<TripRecord, 'userId'>[];
  plannedTrips: Omit<PlannedTrip, 'userId'>[];
  recurringTrips: Omit<RecurringTrip, 'userId'>[];
  savedRoutes: Omit<SavedRouteRecord, 'userId'>[];
}

/** Rattache l'identifiant de proprietaire, retire avant l'envoi au serveur. */
function withOwner<T>(records: T[], userId: string): (T & { userId: string })[] {
  return records.map((record) => ({ ...record, userId }));
}

function withoutOwner<T extends { userId: string }>(records: T[]): Omit<T, 'userId'>[] {
  return records.map((record) => {
    const copy: Partial<T> = { ...record };
    delete copy.userId;
    return copy as Omit<T, 'userId'>;
  });
}

export function applyRemoteState(userId: string, state: RemoteState): void {
  replaceTripHistory(userId, withOwner(state.tripRecords, userId));
  replacePlannedTrips(userId, withOwner(state.plannedTrips, userId));
  replaceRecurringTrips(userId, withOwner(state.recurringTrips, userId));
  replaceSavedRoutes(userId, withOwner(state.savedRoutes, userId));
}

export function readLocalState(user: SessionUser): LocalState {
  return {
    profile: user.profile,
    tripRecords: withoutOwner(loadTripHistory(user.id)),
    plannedTrips: withoutOwner(loadPlannedTrips(user.id)),
    recurringTrips: withoutOwner(loadRecurringTrips(user.id)),
    savedRoutes: withoutOwner(loadSavedRoutes(user.id)),
  };
}
