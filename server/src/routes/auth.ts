// Inscription, connexion, déconnexion, reprise de session.
// Le navigateur ne detient qu'un cookie httpOnly : ni le mot de passe ni son
// empreinte ne quittent le serveur.
import { completeDueTrips } from '../services/planned-trips.ts';
import { Elysia } from 'elysia';
import type { ServerConfig } from '../config/index.ts';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import { rateLimit } from '../plugins/rate-limit.ts';
import { DEFAULT_PROFILE, TERMS_VERSION, credentials, errorResponse, okResponse, registration, session } from '../../../src/contracts/index.ts';
import { toSessionUser } from '../repositories/index.ts';
import { hashPassword, verifyPassword } from '../security/password.ts';
import { hashToken } from '../security/tokens.ts';
import { SESSION_COOKIE, openSession } from '../services/sessions.ts';
import type { MobilityProfile } from '../../../src/types.ts';

// Message unique pour "email inconnu" et "mot de passe faux" : ne pas offrir
// d'oracle d'énumération de comptes (OWASP A07).
const INVALID_CREDENTIALS = 'Identifiants invalides.';

export function authRoutes(ctx: AppContext, config: ServerConfig) {
    return new Elysia({ prefix: '/auth', tags: ['Authentification'] })
        .use(ctx)
        // Limite resserree sur l'authentification : freine le bourrage
        // d'identifiants et la création de comptes en masse.
        .use(rateLimit({ max: 10, windowMs: 60_000, scope: 'auth', trustProxy: config.trustProxy }))
        .post(
            '/register',
            async ({ body, cookie, repositories, status }) => {
                const { users, sessions, state } = repositories;
                if (users.findByEmail(body.email)) {
                    return status(409, { error: 'Un compte existe déjà avec cet email.' });
                }

                const profile: MobilityProfile = { ...DEFAULT_PROFILE, displayName: body.displayName };
                const now = new Date().toISOString();
                const row = {
                    id: crypto.randomUUID(),
                    email: body.email,
                    displayName: body.displayName,
                    passwordHash: await hashPassword(body.password),
                    createdAt: now,
                    // Le contrat garantit l'acceptation ; on garde sa date et la
                    // version du texte accepté (preuve, RGPD art. 5.2).
                    termsAcceptedAt: now,
                    termsVersion: TERMS_VERSION,
                    profile,
                };
                users.insert(row);
                openSession(cookie, sessions, config, row.id);

                return status(201, { user: toSessionUser(row), state: state.fullState(row.id, profile) });
            },
            {
                body: registration,
                response: { 201: session, 409: errorResponse, 429: errorResponse },
                detail: { summary: 'Créer un compte et ouvrir une session' },
            },
        )
        .post(
            '/login',
            async ({ body, cookie, repositories, status, db }) => {
                const { users, sessions, state } = repositories;
                const row = users.findByEmail(body.email);

                if (!row) {
                    // Vérification à vide : le temps de réponse ne trahit pas
                    // l'existence du compte (attaque temporelle sur l'énumération).
                    await verifyPassword(body.password, await hashPassword(crypto.randomUUID()));
                    return status(401, { error: INVALID_CREDENTIALS });
                }
                if (!(await verifyPassword(body.password, row.passwordHash))) {
                    return status(401, { error: INVALID_CREDENTIALS });
                }

                openSession(cookie, sessions, config, row.id);
                completeDueTrips(db, row.id);
                const user = toSessionUser(row);
                return { user, state: state.fullState(row.id, user.profile) };
            },
            {
                body: credentials,
                response: { 200: session, 401: errorResponse, 429: errorResponse },
                detail: { summary: 'Ouvrir une session' },
            },
        )
        .post(
            '/logout',
            ({ cookie, repositories }) => {
                const token = cookie[SESSION_COOKIE]?.value;
                if (token) {
                    // Révocation en base : le jeton est inutilisable même s'il a fuite.
                    repositories.sessions.revoke(hashToken(String(token)));
                }
                cookie[SESSION_COOKIE]?.remove();
                return { ok: true };
            },
            {
                response: okResponse,
                detail: { summary: 'Fermer la session et la révoquer côté serveur' },
            },
        )
        .use(authGuard(ctx))
        .get(
            '/session',
            ({ userId, repositories, status, db }) => {
                const row = repositories.users.findById(userId);
                if (!row) {
                    return status(401, { error: 'Session expirée.' });
                }
                const user = toSessionUser(row);
                completeDueTrips(db, userId);
                return { user, state: repositories.state.fullState(user.id, user.profile) };
            },
            {
                response: { 200: session, 401: errorResponse },
                detail: { summary: 'Reprendre la session portée par le cookie' },
            },
        );
}
