// Ressource itinéraire enregistré : aucune commande ne transporte la liste
// complète du compte.
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import {
    errorResponse,
    okResponse,
    resourceIdParams,
    savedRoute,
    savedRouteInput,
    savedRoutes,
} from '../../../src/contracts/index.ts';
import { saveSavedRoute } from '../services/saved-routes.ts';

export function savedRouteRoutes(ctx: AppContext) {
    return new Elysia({ prefix: '/saved-routes', tags: ['Itinéraires enregistrés'] })
        .use(authGuard(ctx))
        .get('', ({ userId, repositories }) => repositories.savedRoutes.list(userId), {
            response: { 200: savedRoutes, 401: errorResponse },
            detail: { summary: 'Lire les itinéraires enregistrés' },
        })
        .put(
            '/:id',
            ({ userId, params, body, db, status }) => {
                const saved = saveSavedRoute(db, { ...body, id: params.id, userId });
                return saved ?? status(409, { error: 'Cet itinéraire dépasse la limite de conservation.' });
            },
            {
                params: resourceIdParams,
                body: savedRouteInput,
                response: { 200: savedRoute, 401: errorResponse, 409: errorResponse, 422: errorResponse },
                detail: { summary: 'Créer ou remplacer un itinéraire enregistré (idempotent)' },
            },
        )
        .delete(
            '/:id',
            ({ userId, params, repositories }) => {
                repositories.savedRoutes.deleteById(userId, params.id);
                return { ok: true };
            },
            {
                params: resourceIdParams,
                response: { 200: okResponse, 401: errorResponse, 422: errorResponse },
                detail: { summary: 'Supprimer un itinéraire enregistré (idempotent)' },
            },
        );
}
