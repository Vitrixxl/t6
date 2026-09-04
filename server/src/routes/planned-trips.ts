// Ressource trajet programme : lecture de la collection, ecriture/suppression
// d'un element, et transition atomique vers l'historique carbone.
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import {
  completedPlannedTrip,
  errorResponse,
  okResponse,
  plannedTrip,
  plannedTripInput,
  plannedTrips,
  resourceIdParams,
} from '../../../src/contracts/index.ts';
import { completePlannedTrip, deletePlannedTrip, savePlannedTrip } from '../services/planned-trips.ts';

export function plannedTripRoutes(ctx: AppContext) {
  return new Elysia({ prefix: '/trips/planned', tags: ['Trajets programmes'] })
    .use(authGuard(ctx))
    .get('', ({ userId, repositories }) => repositories.plannedTrips.list(userId), {
      response: { 200: plannedTrips, 401: errorResponse },
      detail: { summary: 'Lire les trajets programmes' },
    })
    .put(
      '/:id',
      ({ userId, params, body, db, status }) => {
        const saved = savePlannedTrip(db, { ...body, id: params.id, userId });
        return saved ?? status(409, { error: 'Ce trajet depasse la limite de conservation.' });
      },
      {
        params: resourceIdParams,
        body: plannedTripInput,
        response: { 200: plannedTrip, 401: errorResponse, 409: errorResponse, 422: errorResponse },
        detail: { summary: 'Creer ou remplacer un trajet programme (idempotent)' },
      },
    )
    .put(
      '/:id/completion',
      ({ userId, params, db, status }) => {
        const completed = completePlannedTrip(db, userId, params.id);
        return completed ?? status(404, { error: 'Trajet programme introuvable.' });
      },
      {
        params: resourceIdParams,
        response: { 200: completedPlannedTrip, 401: errorResponse, 404: errorResponse, 422: errorResponse },
        detail: { summary: 'Marquer un trajet fait et alimenter l historique (idempotent)' },
      },
    )
    .delete(
      '/:id',
      ({ userId, params, db }) => {
        deletePlannedTrip(db, userId, params.id);
        return { ok: true };
      },
      {
        params: resourceIdParams,
        response: { 200: okResponse, 401: errorResponse, 422: errorResponse },
        detail: { summary: 'Supprimer un trajet programme (idempotent)' },
      },
    );
}
