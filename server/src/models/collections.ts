// Contrats des collections du compte. Chaque collection se remplace en
// entier par un PUT qui lui est propre : le client n'envoie pas ses mutations
// une par une, il renvoie la liste telle qu'il la tient. Rejouer le meme PUT
// apres une reponse perdue donne le meme resultat — l'idempotence vient du
// verbe, sans journal d'operations. Chaque liste est bornee, donc la requete
// reste petite et son cout previsible.
import { t } from 'elysia';
import { PLANNED_LIMIT, RECURRING_LIMIT, SAVED_ROUTES_LIMIT, TRIP_HISTORY_LIMIT } from '../repositories/limits.ts';
import {
  ownedPlannedTrip,
  ownedRecurringTrip,
  ownedSavedRoute,
  ownedTripRecord,
  plannedTrip,
  recurringTrip,
  savedRoute,
  tripRecord,
} from './trips.ts';

// Corps envoyes par le client : sans proprietaire, le serveur le deduit de la session.
export const tripRecordsInput = t.Array(tripRecord, { maxItems: TRIP_HISTORY_LIMIT });
export const plannedTripsInput = t.Array(plannedTrip, { maxItems: PLANNED_LIMIT });
export const recurringTripsInput = t.Array(recurringTrip, { maxItems: RECURRING_LIMIT });
export const savedRoutesInput = t.Array(savedRoute, { maxItems: SAVED_ROUTES_LIMIT });

// Collections telles que le serveur les rend, proprietaire compris.
export const ownedTripRecords = t.Array(ownedTripRecord);
export const ownedPlannedTrips = t.Array(ownedPlannedTrip);
export const ownedRecurringTrips = t.Array(ownedRecurringTrip);
export const ownedSavedRoutes = t.Array(ownedSavedRoute);
