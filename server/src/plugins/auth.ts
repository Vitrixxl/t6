// Garde d'authentification. `resolve` calcule une valeur dérivée du contexte
// avant le gestionnaire : ici l'identifiant de l'utilisateur porte par le
// cookie de session. Toute route qui monte ce plugin reçoit un `userId` déjà
// typé comme une chaîne, et n'a aucune vérification à refaire.
//
// Le contexte est passe en argument, jamais reconstruit : il porte la
// connexion à la base, il ne doit exister qu'une fois par application.
import { Elysia } from 'elysia';
import type { AppContext } from './context.ts';
import { hashToken } from '../security/tokens.ts';
import { SESSION_COOKIE } from '../services/sessions.ts';

export function authGuard(ctx: AppContext) {
    return new Elysia({ name: 'auth-guard' })
        .use(ctx)
        .resolve({ as: 'scoped' }, ({ cookie, repositories, status }) => {
            const token = cookie[SESSION_COOKIE]?.value;
            if (!token) {
                return status(401, { error: 'Authentification requise.' });
            }

            const session = repositories.sessions.findValid(hashToken(String(token)), new Date().toISOString());
            if (!session) {
                cookie[SESSION_COOKIE]?.remove();
                return status(401, { error: 'Session expirée.' });
            }

            return { userId: session.user_id };
        });
}
