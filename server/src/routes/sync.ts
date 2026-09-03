// Synchronisation client <-> serveur.
//
// Le client travaille sur son cache local et, des que le reseau le permet,
// envoie son etat complet ; le serveur le remplace. La route valide, ouvre une
// transaction et delegue au service : elle ne porte aucune regle metier.
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import { errorResponse, userState, userStateInput } from '../models/index.ts';
import { createRepositories } from '../repositories/index.ts';
import { replaceState } from '../services/sync.ts';

export function syncRoutes(ctx: AppContext) {
  return new Elysia({ prefix: '/state', tags: ['Synchronisation'] })
    .use(authGuard(ctx))
    .get(
      '/',
      ({ userId, repositories, status }) => {
        const row = repositories.users.findById(userId);
        if (!row) {
          return status(401, { error: 'Session expiree.' });
        }
        return repositories.state.fullState(userId, row.profile);
      },
      {
        response: { 200: userState, 401: errorResponse },
        detail: { summary: 'Lire l etat complet du compte' },
      },
    )
    .put(
      '/',
      ({ userId, body, db, repositories, status }) => {
        // Les depots sont construits sur la transaction : chaque ecriture du
        // service passe par elle. Une validation qui echoue n'atteint jamais
        // ce point ; une erreur en cours de remplacement annule tout.
        db.transaction((tx) => replaceState(createRepositories(tx), userId, body));

        const row = repositories.users.findById(userId);
        if (!row) {
          return status(401, { error: 'Session expiree.' });
        }
        return repositories.state.fullState(userId, row.profile);
      },
      {
        body: userStateInput,
        response: { 200: userState, 401: errorResponse, 422: errorResponse },
        detail: { summary: 'Remplacer l etat complet du compte (idempotent)' },
      },
    );
}
