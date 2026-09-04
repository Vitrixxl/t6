// Etat du compte : rendu en entier a l'ouverture de session, puis une route
// par partie, en lecture (GET) comme en remplacement (PUT).
//
// Le serveur est la seule source de verite. Le client tient chaque partie
// dans son cache de requetes (src/queries/) et, apres une action, renvoie en
// entier la ou les parties qu'elle a touchees, chacune vers sa route. Changer
// une preference n'envoie aucun trajet.
import type { AccountState, Session } from '../../contracts';
import { ApiError, ApiUnavailableError } from './errors';
import { api, treatyRequest } from './client';

export type { AccountState, Session };

/** Une partie de l'etat : le profil, ou l'une des collections. */
export type AccountPart = keyof AccountState;

export const ACCOUNT_PARTS: readonly AccountPart[] = ['profile', 'tripRecords', 'plannedTrips', 'recurringTrips', 'savedRoutes'];

/** Les parties presentes dans un lot de modifications. */
export function accountPartsOf(changes: Partial<AccountState>): AccountPart[] {
  return ACCOUNT_PARTS.filter((part) => part in changes);
}

/**
 * Reprise de session au demarrage : le cookie httpOnly porte la session, le
 * serveur repond avec le compte et son etat. Sans session valide, ou sans
 * serveur, l'ecran de connexion prend le relais.
 */
export async function restoreSession(): Promise<Session | null> {
  try {
    return await treatyRequest(api.auth.session.get());
  } catch (error) {
    if (error instanceof ApiUnavailableError || (error instanceof ApiError && error.status === 401)) {
      return null;
    }
    throw error;
  }
}

/** Le proprietaire n'est jamais transmis : le serveur le deduit de la session. */
function withoutOwner<T extends { userId: string }>(record: T): Omit<T, 'userId'> {
  const { userId, ...payload } = record;
  void userId;
  return payload;
}

function withoutOwners<T extends { userId: string }>(records: T[]): Array<Omit<T, 'userId'>> {
  return records.map(withoutOwner);
}

/** Lit une partie telle que le serveur la tient. */
export function fetchAccountPart<P extends AccountPart>(part: P): Promise<AccountState[P]>;
export function fetchAccountPart(part: AccountPart): Promise<AccountState[AccountPart]> {
  switch (part) {
    case 'profile':
      return treatyRequest(api.me.profile.get());
    case 'tripRecords':
      return treatyRequest(api.trips.history.get());
    case 'plannedTrips':
      return treatyRequest(api.trips.planned.get());
    case 'recurringTrips':
      return treatyRequest(api.trips.recurring.get());
    case 'savedRoutes':
      return treatyRequest(api['saved-routes'].get());
  }
}

/** Remplace une partie sur le serveur, qui la rend telle qu'elle est desormais. PUT : rejouer donne le meme resultat. */
type AccountEntry = {
  [P in AccountPart]: [part: P, value: AccountState[P]];
}[AccountPart];

export function saveAccountPart<P extends AccountPart>(part: P, value: AccountState[P]): Promise<AccountState[P]>;
export function saveAccountPart(...entry: AccountEntry): Promise<AccountState[AccountPart]> {
  switch (entry[0]) {
    case 'profile':
      return treatyRequest(api.me.profile.put(entry[1]));
    case 'tripRecords':
      return treatyRequest(api.trips.history.put(withoutOwners(entry[1])));
    case 'plannedTrips':
      return treatyRequest(api.trips.planned.put(withoutOwners(entry[1])));
    case 'recurringTrips':
      return treatyRequest(api.trips.recurring.put(withoutOwners(entry[1])));
    case 'savedRoutes':
      return treatyRequest(api['saved-routes'].put(withoutOwners(entry[1])));
  }
}

async function savePart<P extends AccountPart>(saved: Partial<AccountState>, part: P, value: AccountState[P]): Promise<void> {
  saved[part] = await saveAccountPart(part, value);
}

/** Envoie plusieurs parties en parallele : elles sont independantes. Echoue si l'une echoue. */
export async function saveAccountParts(changes: Partial<AccountState>): Promise<Partial<AccountState>> {
  const saved: Partial<AccountState> = {};
  await Promise.all(
    accountPartsOf(changes).map((part) => {
      const value = changes[part];
      return value === undefined ? Promise.resolve() : savePart(saved, part, value);
    }),
  );
  return saved;
}
