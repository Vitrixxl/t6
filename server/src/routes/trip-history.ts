// Historique carbone : lecture, puis effacement volontaire. Les lignes sont
// créées uniquement par la complétion d'un trajet programmé.
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import { errorResponse, okResponse, tripRecords } from '../../../src/contracts/index.ts';

export function tripHistoryRoutes(ctx: AppContext) {
    return new Elysia({ prefix: '/trips/history', tags: ['Historique'] })
        .use(authGuard(ctx))
        .get('', ({ userId, repositories }) => repositories.tripRecords.list(userId), {
            response: { 200: tripRecords, 401: errorResponse },
            detail: { summary: 'Lire l’historique des trajets réalisés' },
        })
        .delete(
            '',
            ({ userId, repositories }) => {
                repositories.tripRecords.clear(userId);
                return { ok: true };
            },
            {
                response: { 200: okResponse, 401: errorResponse },
                detail: { summary: 'Effacer volontairement tout l’historique (idempotent)' },
            },
        );
}
