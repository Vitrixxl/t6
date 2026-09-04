// Ressource routine : la collection se lit, chaque élément s'ecrit ou se
// supprime par son identifiant.
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import {
    errorResponse,
    okResponse,
    recurringTrip,
    recurringTripInput,
    recurringTrips,
    resourceIdParams,
} from '../../../src/contracts/index.ts';
import { saveRecurringTrip } from '../services/recurring-trips.ts';

export function recurringTripRoutes(ctx: AppContext) {
    return new Elysia({ prefix: '/trips/recurring', tags: ['Routines'] })
        .use(authGuard(ctx))
        .get('', ({ userId, repositories }) => repositories.recurringTrips.list(userId), {
            response: { 200: recurringTrips, 401: errorResponse },
            detail: { summary: 'Lire les routines' },
        })
        .put(
            '/:id',
            ({ userId, params, body, db, status }) => {
                const saved = saveRecurringTrip(db, { ...body, id: params.id, userId });
                return saved ?? status(409, { error: 'La limite de routines est atteinte.' });
            },
            {
                params: resourceIdParams,
                body: recurringTripInput,
                response: { 200: recurringTrip, 401: errorResponse, 409: errorResponse, 422: errorResponse },
                detail: { summary: 'Créer ou remplacer une routine (idempotent)' },
            },
        )
        .delete(
            '/:id',
            ({ userId, params, repositories }) => {
                repositories.recurringTrips.deleteById(userId, params.id);
                return { ok: true };
            },
            {
                params: resourceIdParams,
                response: { 200: okResponse, 401: errorResponse, 422: errorResponse },
                detail: { summary: 'Supprimer une routine (idempotent)' },
            },
        );
}
