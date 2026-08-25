// Inscription, connexion, deconnexion, reprise de session.
// Le navigateur ne detient qu'un cookie httpOnly : ni le mot de passe ni son
// empreinte ne quittent le serveur.
import { Elysia } from 'elysia';
import type { ServerConfig } from '../config/index.ts';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import { rateLimit } from '../plugins/rate-limit.ts';
import { authenticatedResponse, credentials, errorResponse, okResponse, registration } from '../models/index.ts';
import { DEFAULT_PROFILE } from '../models/profile.ts';
import { toSessionUser } from '../repositories/index.ts';
import { hashPassword, verifyPassword } from '../security/password.ts';
import { hashToken } from '../security/tokens.ts';
import { SESSION_COOKIE, openSession } from '../services/sessions.ts';
import type { MobilityProfile } from '../../../src/types.ts';

// Message unique pour "email inconnu" et "mot de passe faux" : ne pas offrir
// d'oracle d'enumeration de comptes (OWASP A07).
const INVALID_CREDENTIALS = 'Identifiants invalides.';

export function authRoutes(ctx: AppContext, config: ServerConfig) {
  return new Elysia({ prefix: '/auth', tags: ['Authentification'] })
    .use(ctx)
    // Limite resserree sur l'authentification : freine le bourrage
    // d'identifiants et la creation de comptes en masse.
    .use(rateLimit({ max: 10, windowMs: 60_000, scope: 'auth', trustProxy: config.trustProxy }))
    .post(
      '/register',
      async ({ body, cookie, repositories, status }) => {
        const { users, sessions, state } = repositories;
        if (users.findByEmail(body.email)) {
          return status(409, { error: 'Un compte existe deja avec cet email.' });
        }

        const profile: MobilityProfile = { ...DEFAULT_PROFILE, displayName: body.displayName };
        const row = {
          id: crypto.randomUUID(),
          email: body.email,
          display_name: body.displayName,
          password_hash: await hashPassword(body.password),
          created_at: new Date().toISOString(),
          profile_json: JSON.stringify(profile),
        };
        users.insert(row);
        openSession(cookie, sessions, config, row.id);

        return status(201, { user: toSessionUser(row), state: state.fullState(row.id, profile) });
      },
      {
        body: registration,
        response: { 201: authenticatedResponse, 409: errorResponse, 429: errorResponse },
        detail: { summary: 'Creer un compte et ouvrir une session' },
      },
    )
    .post(
      '/login',
      async ({ body, cookie, repositories, status }) => {
        const { users, sessions, state } = repositories;
        const row = users.findByEmail(body.email);

        if (!row) {
          // Verification a vide : le temps de reponse ne trahit pas
          // l'existence du compte (attaque temporelle sur l'enumeration).
          await verifyPassword(body.password, await hashPassword(crypto.randomUUID()));
          return status(401, { error: INVALID_CREDENTIALS });
        }
        if (!(await verifyPassword(body.password, row.password_hash))) {
          return status(401, { error: INVALID_CREDENTIALS });
        }

        openSession(cookie, sessions, config, row.id);
        const user = toSessionUser(row);
        return { user, state: state.fullState(row.id, user.profile) };
      },
      {
        body: credentials,
        response: { 200: authenticatedResponse, 401: errorResponse, 429: errorResponse },
        detail: { summary: 'Ouvrir une session' },
      },
    )
    .post(
      '/logout',
      ({ cookie, repositories }) => {
        const token = cookie[SESSION_COOKIE]?.value;
        if (token) {
          // Revocation en base : le jeton est inutilisable meme s'il a fuite.
          repositories.sessions.revoke(hashToken(String(token)));
        }
        cookie[SESSION_COOKIE]?.remove();
        return { ok: true };
      },
      {
        response: okResponse,
        detail: { summary: 'Fermer la session et la revoquer cote serveur' },
      },
    )
    .use(authGuard(ctx))
    .get(
      '/session',
      ({ userId, repositories, status }) => {
        const row = repositories.users.findById(userId);
        if (!row) {
          return status(401, { error: 'Session expiree.' });
        }
        const user = toSessionUser(row);
        return { user, state: repositories.state.fullState(user.id, user.profile) };
      },
      {
        response: { 200: authenticatedResponse, 401: errorResponse },
        detail: { summary: 'Reprendre la session portee par le cookie' },
      },
    );
}
