// Routes du compte : profil de mobilité, portabilite et effacement (RGPD).
import { completeDueTrips } from '../services/planned-trips.ts';
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import { accountExport, errorResponse, mobilityProfile, okResponse } from '../../../src/contracts/index.ts';
import { toSessionUser } from '../repositories/index.ts';
import { hashToken } from '../security/tokens.ts';
import { SESSION_COOKIE } from '../services/sessions.ts';

export function meRoutes(ctx: AppContext) {
    return new Elysia({ prefix: '/me', tags: ['Compte'] })
        .use(authGuard(ctx))
        .get(
            '/profile',
            ({ userId, repositories, status }) => {
                const row = repositories.users.findById(userId);
                if (!row) {
                    return status(401, { error: 'Session expirée.' });
                }
                return row.profile;
            },
            {
                response: { 200: mobilityProfile, 401: errorResponse },
                detail: { summary: 'Lire le profil de mobilité' },
            },
        )
        // Le profil se remplace seul : changer une préférence ne réécrit aucun
        // trajet. Le nom affiché suit le profil, la session le rend à jour.
        .put(
            '/profile',
            ({ userId, body, repositories, status }) => {
                repositories.users.updateProfile(userId, body);
                const row = repositories.users.findById(userId);
                if (!row) {
                    return status(401, { error: 'Session expirée.' });
                }
                return row.profile;
            },
            {
                body: mobilityProfile,
                response: { 200: mobilityProfile, 401: errorResponse, 422: errorResponse },
                detail: { summary: 'Remplacer le profil de mobilité (idempotent)' },
            },
        )
        // Droit à la portabilite (RGPD art. 20) : l'utilisateur récupère en un
        // appel tout ce que le serveur detient sur lui, dans un format ouvert.
        .get(
            '/export',
            ({ userId, repositories, set, status, db }) => {
                const row = repositories.users.findById(userId);
                if (!row) {
                    return status(401, { error: 'Session expirée.' });
                }
                completeDueTrips(db, userId);
                const user = toSessionUser(row);
                set.headers['content-disposition'] = 'attachment; filename="urbanflow-export.json"';

                return {
                    exportedAt: new Date().toISOString(),
                    account: {
                        id: user.id,
                        email: user.email,
                        displayName: user.displayName,
                        createdAt: row.createdAt,
                        termsAcceptedAt: row.termsAcceptedAt,
                        termsVersion: row.termsVersion,
                    },
                    ...repositories.state.fullState(userId, user.profile),
                };
            },
            {
                response: { 200: accountExport, 401: errorResponse },
                detail: { summary: 'Exporter toutes les données du compte (RGPD art. 20)' },
            },
        )
        // Droit à l'effacement (RGPD art. 17) : la suppression emporte en cascade
        // trajets, routines, itinéraires sauvegardes et sessions ouvertes.
        .delete(
            '/',
            ({ userId, cookie, repositories }) => {
                const token = cookie[SESSION_COOKIE]?.value;
                if (token) {
                    repositories.sessions.revoke(hashToken(String(token)));
                }
                repositories.users.delete(userId);
                cookie[SESSION_COOKIE]?.remove();
                return { ok: true };
            },
            {
                response: { 200: okResponse, 401: errorResponse },
                detail: { summary: 'Supprimer le compte et toutes ses données (RGPD art. 17)' },
            },
        );
}
