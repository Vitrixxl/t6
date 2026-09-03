// Etat du compte : ce que le serveur renvoie a la connexion, et ce que le
// client lui renvoie, partie par partie, apres chaque action.
//
// Le serveur est la seule source de verite. Le client garde l'etat en memoire
// le temps de la session, sans cache local. Une action modifie une ou deux
// parties de l'etat ; seules celles-la repartent, chacune vers sa propre
// route, en entier. Changer une preference n'envoie aucun trajet.
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

/** Une partie de l'etat : le profil, ou l'une des collections. */
export type AccountPart = keyof AccountState;

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

/** Une route par partie : chaque PUT remplace la partie en entier. */
const PART_PATHS: Record<AccountPart, string> = {
  profile: '/me/profile',
  tripRecords: '/trips/history',
  plannedTrips: '/trips/planned',
  recurringTrips: '/trips/recurring',
  savedRoutes: '/saved-routes',
};

/** Le proprietaire n'est jamais transmis : le serveur le deduit de la session. */
function withoutOwner(records: ReadonlyArray<{ userId: string }>): object[] {
  return records.map((record) => {
    const copy: Record<string, unknown> = { ...record };
    delete copy.userId;
    return copy;
  });
}

function payloadOf(state: AccountState, part: AccountPart): unknown {
  return part === 'profile' ? state.profile : withoutOwner(state[part]);
}

/** Remplace une partie de l'etat sur le serveur. PUT : rejouer donne le meme resultat. */
export async function saveAccountPart(state: AccountState, part: AccountPart): Promise<void> {
  await apiRequest(PART_PATHS[part], { method: 'PUT', body: JSON.stringify(payloadOf(state, part)) });
}

/** Envoie plusieurs parties en parallele : elles sont independantes. Echoue si l'une echoue. */
export async function saveAccountParts(state: AccountState, parts: Iterable<AccountPart>): Promise<void> {
  await Promise.all([...parts].map((part) => saveAccountPart(state, part)));
}
