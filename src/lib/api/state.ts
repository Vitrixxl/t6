// Hydratation du cache local a partir de l'etat serveur.
//
// Les caches locaux restent la seule source lue par l'interface : le serveur
// ne parle jamais directement aux composants. Cette indirection est ce qui
// permet a l'application de fonctionner a l'identique avec ou sans API.
import { replaceTripHistory } from '../carbon';
import { replacePlannedTrips, replaceRecurringTrips } from '../trips';
import { replaceSavedRoutes } from '../savedRoutes';
import type { RemoteState } from './operations';

/** Rattache l'identifiant de proprietaire, retire avant l'envoi au serveur. */
function withOwner<T>(records: T[], userId: string): (T & { userId: string })[] {
  return records.map((record) => ({ ...record, userId }));
}

export function applyRemoteState(userId: string, state: RemoteState): void {
  replaceTripHistory(userId, withOwner(state.tripRecords, userId));
  replacePlannedTrips(userId, withOwner(state.plannedTrips, userId));
  replaceRecurringTrips(userId, withOwner(state.recurringTrips, userId));
  replaceSavedRoutes(userId, withOwner(state.savedRoutes, userId));
}
