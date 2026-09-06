// Authentification : inscription, connexion, déconnexion, effacement.
//
// Le serveur authentifie et detient l'état. Le navigateur ne garde qu'un
// cookie httpOnly ; l'état du compte lui est rendu à chaque ouverture de
// session, puis amorce les requêtes de chaque ressource.
import type { Credentials, Registration, Session } from '../../contracts';
import { api, treatyRequest } from './client';
import { ApiError, ApiUnavailableError } from './errors';

/** Reprend la session portée par le cookie, sans transformer une absence en erreur d'écran. */
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

export async function registerUser(input: Registration): Promise<Session> {
    return treatyRequest(api.auth.register.post({
        email: input.email.trim(),
        password: input.password,
        displayName: input.displayName,
        termsAccepted: input.termsAccepted,
    }));
}

export async function loginUser(input: Credentials): Promise<Session> {
    return treatyRequest(api.auth.login.post({ email: input.email.trim(), password: input.password }));
}

export async function logoutUser(): Promise<void> {
    // La session est révoquée côté serveur ; un échec réseau ne doit pas
    // empecher de quitter l'écran, le cookie expirera de lui-même.
    await treatyRequest(api.auth.logout.post()).then(() => undefined, () => undefined);
}

/** Droit à l'effacement (RGPD art. 17) : le serveur supprime tout en cascade. */
export async function deleteAccount(): Promise<void> {
    await treatyRequest(api.me.delete());
}
