// Etat du compte : lecture complete a l'ouverture de session, puis une route
// par collection, en lecture comme en ecriture.
//
// Le client tient chaque collection dans son cache et, apres une action,
// renvoie en entier celle(s) qu'elle a touchee(s). Chaque PUT ne concerne
// qu'une liste : un trajet planifie n'emporte ni l'historique ni le profil.
// Le GET rend la liste telle qu'elle est en base : c'est lui que le client
// relit quand un envoi a ete refuse. Les routes valident et deleguent au
// service : elles ne portent aucune regle metier.
import { Elysia } from 'elysia';
import { authGuard } from '../plugins/auth.ts';
import type { AppContext } from '../plugins/context.ts';
import {
  accountState,
  errorResponse,
  plannedTrips,
  plannedTripsInput,
  recurringTrips,
  recurringTripsInput,
  savedRoutes,
  savedRoutesInput,
  tripRecords,
  tripRecordsInput,
} from '../../../src/contracts/index.ts';
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
        response: { 200: accountState, 401: errorResponse },
        detail: { summary: 'Lire l etat complet du compte' },
      },
    )
    .get('/trips/planned', ({ userId, repositories }) => repositories.plannedTrips.list(userId), {
      response: { 200: plannedTrips, 401: errorResponse },
      detail: { summary: 'Lire les trajets programmes' },
    })
    .put('/trips/planned', ({ userId, body, db }) => replaceCollection(db, userId, (r) => r.plannedTrips, body), {
      body: plannedTripsInput,
      response: { 200: plannedTrips, 401: errorResponse, 422: errorResponse },
      detail: { summary: 'Remplacer les trajets programmes (idempotent)' },
    })
    .get('/trips/recurring', ({ userId, repositories }) => repositories.recurringTrips.list(userId), {
      response: { 200: recurringTrips, 401: errorResponse },
      detail: { summary: 'Lire les routines' },
    })
    .put('/trips/recurring', ({ userId, body, db }) => replaceCollection(db, userId, (r) => r.recurringTrips, body), {
      body: recurringTripsInput,
      response: { 200: recurringTrips, 401: errorResponse, 422: errorResponse },
      detail: { summary: 'Remplacer les routines (idempotent)' },
    })
    .get('/trips/history', ({ userId, repositories }) => repositories.tripRecords.list(userId), {
      response: { 200: tripRecords, 401: errorResponse },
      detail: { summary: 'Lire l historique des trajets realises' },
    })
    .put('/trips/history', ({ userId, body, db }) => replaceCollection(db, userId, (r) => r.tripRecords, body), {
      body: tripRecordsInput,
      response: { 200: tripRecords, 401: errorResponse, 422: errorResponse },
      detail: { summary: 'Remplacer l historique des trajets realises (idempotent)' },
    })
    .get('/saved-routes', ({ userId, repositories }) => repositories.savedRoutes.list(userId), {
      response: { 200: savedRoutes, 401: errorResponse },
      detail: { summary: 'Lire les itineraires enregistres' },
    })
    .put('/saved-routes', ({ userId, body, db }) => replaceCollection(db, userId, (r) => r.savedRoutes, body), {
      body: savedRoutesInput,
      response: { 200: savedRoutes, 401: errorResponse, 422: errorResponse },
      detail: { summary: 'Remplacer les itineraires enregistres (idempotent)' },
    });
}
