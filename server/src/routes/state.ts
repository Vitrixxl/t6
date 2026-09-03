// Etat du compte : lecture complete a l'ouverture de session, ecriture par
// collection ensuite.
//
// Le client tient l'etat en memoire et, apres chaque action, renvoie en
// entier la ou les collections qu'elle a touchees. Chaque PUT ne concerne
// qu'une liste : un trajet planifie n'emporte ni l'historique ni le profil.
// Les routes valident et deleguent au service : elles ne portent aucune regle
// metier.
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import {
  errorResponse,
  ownedPlannedTrips,
  ownedRecurringTrips,
  ownedSavedRoutes,
  ownedTripRecords,
  plannedTripsInput,
  recurringTripsInput,
  savedRoutesInput,
  tripRecordsInput,
  userState,
} from '../models/index.ts';
import { replaceCollection } from '../services/collections.ts';

export function stateRoutes(ctx: AppContext) {
  return new Elysia({ tags: ['Etat du compte'] })
    .use(authGuard(ctx))
    .get(
      '/state',
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
    .put('/trips/planned', ({ userId, body, db }) => replaceCollection(db, userId, (r) => r.plannedTrips, body), {
      body: plannedTripsInput,
      response: { 200: ownedPlannedTrips, 401: errorResponse, 422: errorResponse },
      detail: { summary: 'Remplacer les trajets programmes (idempotent)' },
    })
    .put('/trips/recurring', ({ userId, body, db }) => replaceCollection(db, userId, (r) => r.recurringTrips, body), {
      body: recurringTripsInput,
      response: { 200: ownedRecurringTrips, 401: errorResponse, 422: errorResponse },
      detail: { summary: 'Remplacer les routines (idempotent)' },
    })
    .put('/trips/history', ({ userId, body, db }) => replaceCollection(db, userId, (r) => r.tripRecords, body), {
      body: tripRecordsInput,
      response: { 200: ownedTripRecords, 401: errorResponse, 422: errorResponse },
      detail: { summary: 'Remplacer l historique des trajets realises (idempotent)' },
    })
    .put('/saved-routes', ({ userId, body, db }) => replaceCollection(db, userId, (r) => r.savedRoutes, body), {
      body: savedRoutesInput,
      response: { 200: ownedSavedRoutes, 401: errorResponse, 422: errorResponse },
      detail: { summary: 'Remplacer les itineraires enregistres (idempotent)' },
    });
}
