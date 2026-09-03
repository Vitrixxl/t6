// Etat du compte : ce que le serveur renvoie a la connexion, et ce que le
// client lui renvoie en entier apres chaque action.
//
// Le serveur est la seule source de verite. Le client garde l'etat en memoire
// le temps de la session, sans cache local : une action modifie l'etat, l'etat
// part en PUT, et une ecriture refusee se dit a l'utilisateur.
import type { MobilityProfile, PlannedTrip, RecurringTrip, SavedRouteRecord, SessionUser, TripRecord } from '../../types';
import { ApiError, ApiUnavailableError } from './errors';
import { apiRequest } from './http';

export interface AccountState {
  profile: MobilityProfile;
  tripRecords: TripRecord[];
  plannedTrips: PlannedTrip[];
  recurringTrips: RecurringTrip[];
  savedRoutes: SavedRouteRecord[];
}

/** Ce que rendent l'inscription, la connexion et la reprise de session. */
export interface Session {
  user: SessionUser;
  state: AccountState;
}

/**
 * Reprise de session au demarrage : le cookie httpOnly porte la session, le
 * serveur repond avec le compte et son etat. Sans session valide, ou sans
 * serveur, l'ecran de connexion prend le relais.
 */
export async function restoreSession(): Promise<Session | null> {
  try {
    return await apiRequest<Session>('/auth/session');
  } catch (error) {
    if (error instanceof ApiUnavailableError || (error instanceof ApiError && error.status === 401)) {
      return null;
    }
    throw error;
  }
}

/** Le proprietaire n'est jamais transmis : le serveur le deduit de la session. */
function withoutOwner<T extends { userId: string }>(records: T[]): Omit<T, 'userId'>[] {
  return records.map((record) => {
    const copy: Partial<T> = { ...record };
    delete copy.userId;
    return copy as Omit<T, 'userId'>;
  });
}

/** Remplace l'etat du compte sur le serveur. PUT : rejouer donne le meme resultat. */
export async function saveAccountState(state: AccountState): Promise<void> {
  await apiRequest('/state', {
    method: 'PUT',
    body: JSON.stringify({
      profile: state.profile,
      tripRecords: withoutOwner(state.tripRecords),
      plannedTrips: withoutOwner(state.plannedTrips),
      recurringTrips: withoutOwner(state.recurringTrips),
      savedRoutes: withoutOwner(state.savedRoutes),
    }),
  });
}
