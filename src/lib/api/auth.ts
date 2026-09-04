// Authentification : inscription, connexion, deconnexion, effacement.
//
// Le serveur authentifie et detient l'etat. Le navigateur ne garde qu'un
// cookie httpOnly ; l'etat du compte lui est rendu a chaque ouverture de
// session (voir account.ts).
import type { Credentials, Registration, Session } from '../../contracts';
import { apiRequest } from './http';

export function registerUser(input: Registration): Promise<Session> {
  return apiRequest<Session>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: input.email.trim(), password: input.password, displayName: input.displayName }),
  });
}

export function loginUser(input: Credentials): Promise<Session> {
  return apiRequest<Session>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: input.email.trim(), password: input.password }),
  });
}

export function logoutUser(): void {
  // La session est revoquee cote serveur ; un echec reseau ne doit pas
  // empecher de quitter l'ecran, le cookie expirera de lui-meme.
  void apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
}

/** Droit a l'effacement (RGPD art. 17) : le serveur supprime tout en cascade. */
export async function deleteAccount(): Promise<void> {
  await apiRequest('/me', { method: 'DELETE' });
}
