// Authentification : inscription, connexion, deconnexion, effacement.
//
// Le serveur authentifie et detient l'etat. Le navigateur ne garde qu'un
// cookie httpOnly ; l'etat du compte lui est rendu a chaque ouverture de
// session, puis amorce les requetes de chaque ressource.
import type { Credentials, Registration, Session } from '../../contracts';
import { api, treatyRequest } from './client';
import { ApiError, ApiUnavailableError } from './errors';

/** Reprend la session portee par le cookie, sans transformer une absence en erreur d'ecran. */
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
    }));
}

export async function loginUser(input: Credentials): Promise<Session> {
    return treatyRequest(api.auth.login.post({ email: input.email.trim(), password: input.password }));
}

export async function logoutUser(): Promise<void> {
    // La session est revoquee cote serveur ; un echec reseau ne doit pas
    // empecher de quitter l'ecran, le cookie expirera de lui-meme.
    await treatyRequest(api.auth.logout.post()).then(() => undefined, () => undefined);
}

/** Droit a l'effacement (RGPD art. 17) : le serveur supprime tout en cascade. */
export async function deleteAccount(): Promise<void> {
    await treatyRequest(api.me.delete());
}
