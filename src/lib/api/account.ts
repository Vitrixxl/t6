// Etat du compte : rendu en entier a l'ouverture de session, puis une lecture
// par partie. Les commandes unitaires vivent dans les modules de ressources.
//
// Le serveur est la seule source de verite. Le client tient chaque partie
// dans son cache de requetes (src/queries/). Changer une ressource n'envoie
// jamais la collection dont elle fait partie.
import type { AccountState, Session } from '../../contracts';
import { ApiError, ApiUnavailableError } from './errors';
import { api, treatyRequest } from './client';

export type { AccountState, Session };

/** Une partie de l'etat : le profil, ou l'une des collections. */
export type AccountPart = keyof AccountState;

export const ACCOUNT_PARTS: readonly AccountPart[] = ['profile', 'tripRecords', 'plannedTrips', 'recurringTrips', 'savedRoutes'];

/** Les parties presentes dans un lot de modifications. */
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
