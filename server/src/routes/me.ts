// Routes du compte : profil de mobilite, portabilite et effacement (RGPD).
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import { accountExport, errorResponse, mobilityProfile, okResponse, sessionUser } from '../models/index.ts';
import { toSessionUser } from '../repositories/index.ts';
import { hashToken } from '../security/tokens.ts';
import { SESSION_COOKIE } from '../services/sessions.ts';
import { t } from 'elysia';
import type { MobilityProfile } from '../../../src/types.ts';

export function meRoutes(ctx: AppContext) {
  return new Elysia({ prefix: '/me', tags: ['Compte'] })
    .use(authGuard(ctx))
    .put(
      '/profile',
      ({ userId, body, repositories, status }) => {
        repositories.users.updateProfile(userId, body as MobilityProfile);
        const row = repositories.users.findById(userId);
        if (!row) {
          return status(401, { error: 'Session expiree.' });
        }
        return { user: toSessionUser(row) };
      },
      {
        body: mobilityProfile,
        response: { 200: t.Object({ user: sessionUser }), 401: errorResponse },
        detail: { summary: 'Enregistrer le profil de mobilite' },
      },
    )
    // Droit a la portabilite (RGPD art. 20) : l'utilisateur recupere en un
    // appel tout ce que le serveur detient sur lui, dans un format ouvert.
    .get(
      '/export',
      ({ userId, repositories, set, status }) => {
        const row = repositories.users.findById(userId);
        if (!row) {
          return status(401, { error: 'Session expiree.' });
        }
        const user = toSessionUser(row);
        set.headers['content-disposition'] = 'attachment; filename="urbanflow-export.json"';

        return {
          exportedAt: new Date().toISOString(),
          account: { id: user.id, email: user.email, displayName: user.displayName, createdAt: row.created_at },
          ...repositories.state.fullState(userId, user.profile),
        };
      },
      {
        response: { 200: accountExport, 401: errorResponse },
        detail: { summary: 'Exporter toutes les donnees du compte (RGPD art. 20)' },
      },
    )
    // Droit a l'effacement (RGPD art. 17) : la suppression emporte en cascade
    // trajets, routines, itineraires sauvegardes et sessions ouvertes.
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
        detail: { summary: 'Supprimer le compte et toutes ses donnees (RGPD art. 17)' },
      },
    );
}
