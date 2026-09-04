// Authentification : inscription, connexion, deconnexion, effacement.
//
// Le serveur authentifie et detient l'etat. Le navigateur ne garde qu'un
// cookie httpOnly ; l'etat du compte lui est rendu a chaque ouverture de
// session (voir account.ts).
import type { Credentials, Registration, Session } from '../../contracts';
import { api, treatyRequest } from './client';

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
