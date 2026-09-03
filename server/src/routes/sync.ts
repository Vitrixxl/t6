// Synchronisation client -> serveur.
//
// Le client travaille hors ligne sur son cache local et empile ses mutations
// dans une file d'attente ; il les rejoue ici des que le reseau revient. La
// route valide, ouvre une transaction et delegue au service : elle ne porte
// aucune regle metier.
import { Elysia, t } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import { errorResponse, operationBatch, operationOutcome, userState } from '../models/index.ts';
import { createRepositories } from '../repositories/index.ts';
import { applyOperations } from '../services/sync.ts';

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
    .post(
      '/operations',
      ({ userId, body, db, repositories, status }) => {
        // Le lot est atomique : une operation en echec annule tout le lot, donc
        // le client peut le rejouer entier sans etat intermediaire a deviner.
        // Les depots sont construits sur la transaction : chaque ecriture du
        // service passe par elle, rien ne s'echappe vers la connexion globale.
        const outcome = db.transaction((tx) => applyOperations(createRepositories(tx), userId, body.operations));

        const row = repositories.users.findById(userId);
        if (!row) {
          return status(401, { error: 'Session expiree.' });
        }
        return {
          ...outcome,
          state: repositories.state.fullState(userId, row.profile),
        };
      },
      {
        body: operationBatch,
        response: {
          200: t.Object({ ...operationOutcome.properties, state: userState }),
          401: errorResponse,
          422: errorResponse,
        },
        detail: { summary: 'Rejouer un lot d operations faites hors ligne' },
      },
    );
}
