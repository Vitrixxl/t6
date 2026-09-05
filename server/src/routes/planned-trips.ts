// Ressource trajet programmé : lecture de la collection, ecriture/suppression
// d'un élément, et transition atomique vers l'historique carbone.
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import {
    errorResponse,
    okResponse,
    plannedTrip,
    plannedTripInput,
    plannedTrips,
    resourceIdParams,
} from '../../../src/contracts/index.ts';
import { cancelPlannedTrip, restorePlannedTrip, completeDueTrips, savePlannedTrip } from '../services/planned-trips.ts';

export function plannedTripRoutes(ctx: AppContext) {
    return new Elysia({ prefix: '/trips/planned', tags: ['Trajets programmés'] })
        .use(authGuard(ctx))
        .get('', ({ userId, repositories, db }) => {
            completeDueTrips(db, userId);
            return repositories.plannedTrips.list(userId);
        }, {
            response: { 200: plannedTrips, 401: errorResponse },
            detail: { summary: 'Lire les trajets programmés' },
        })
        .put(
            '/:id',
            ({ userId, params, body, db, status }) => {
                const saved = savePlannedTrip(db, { ...body, id: params.id, userId });
                return saved ?? status(409, { error: 'Ce trajet est déjà terminé ou dépasse la limite de conservation.' });
            },
            {
                params: resourceIdParams,
                body: plannedTripInput,
                response: { 200: plannedTrip, 401: errorResponse, 409: errorResponse, 422: errorResponse },
                detail: { summary: 'Créer ou remplacer un trajet programmé (idempotent)' },
            },
        )
        .put(
            '/:id/cancellation',
            ({ userId, params, db, status }) => {
                const cancelled = cancelPlannedTrip(db, userId, params.id);
                return cancelled ?? status(404, { error: 'Trajet programmé introuvable.' });
            },
            {
                params: resourceIdParams,
                response: { 200: plannedTrip, 401: errorResponse, 404: errorResponse, 422: errorResponse },
                detail: { summary: 'Annuler un trajet, même terminé, et retirer sa contribution carbone (idempotent)' },
            },
        )
        .delete(
            '/:id/cancellation',
            ({ userId, params, db, status }) => {
                const restored = restorePlannedTrip(db, userId, params.id);
                return restored ?? status(404, { error: 'Trajet programmé introuvable.' });
            },
            {
                params: resourceIdParams,
                response: { 200: plannedTrip, 401: errorResponse, 404: errorResponse, 422: errorResponse },
                detail: { summary: 'Rétablir un trajet annulé ; sa date décide de sa réalisation (idempotent)' },
            },
        )
        .delete(
            '/:id',
            ({ userId, params, repositories }) => {
                repositories.plannedTrips.deleteById(userId, params.id);
                return { ok: true };
            },
            {
                params: resourceIdParams,
                response: { 200: okResponse, 401: errorResponse, 422: errorResponse },
                detail: { summary: 'Supprimer un trajet programmé (idempotent)' },
            },
        );
}
