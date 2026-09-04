// Etat du compte : rendu en entier a l'ouverture de session, puis une route
// par partie, en lecture (GET) comme en remplacement (PUT).
//
// Le serveur est la seule source de verite. Le client tient chaque partie
// dans son cache de requetes (src/queries/) et, apres une action, renvoie en
// entier la ou les parties qu'elle a touchees, chacune vers sa route. Changer
// une preference n'envoie aucun trajet.
import type { AccountState, Session } from '../../contracts';
import { ApiError, ApiUnavailableError } from './errors';
import { apiRequest } from './http';

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
    return await apiRequest<Session>('/auth/session');
  } catch (error) {
    if (error instanceof ApiUnavailableError || (error instanceof ApiError && error.status === 401)) {
      return null;
    }
    throw error;
  }
}

/** Une route par partie : GET la lit, PUT la remplace en entier. */
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

function payloadOf(value: AccountState[AccountPart]): unknown {
  return Array.isArray(value) ? withoutOwner(value) : value;
}

/** Lit une partie telle que le serveur la tient. */
export function fetchAccountPart<P extends AccountPart>(part: P): Promise<AccountState[P]> {
  return apiRequest<AccountState[P]>(PART_PATHS[part]);
}

/** Remplace une partie sur le serveur, qui la rend telle qu'elle est desormais. PUT : rejouer donne le meme resultat. */
export function saveAccountPart<P extends AccountPart>(part: P, value: AccountState[P]): Promise<AccountState[P]> {
  return apiRequest<AccountState[P]>(PART_PATHS[part], { method: 'PUT', body: JSON.stringify(payloadOf(value)) });
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
