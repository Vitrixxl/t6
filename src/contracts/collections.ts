// Contrats des collections du compte. Chaque collection se lit et se remplace
// en entier par la route qui lui est propre : le client n'envoie pas ses
// mutations une par une, il renvoie la liste telle qu'il la tient. Rejouer le
// meme PUT apres une reponse perdue donne le meme resultat — l'idempotence
// vient du verbe, sans journal d'operations. Chaque liste est bornee, donc la
// requete reste petite et son cout previsible.
import { z } from 'zod';
import { PLANNED_LIMIT, RECURRING_LIMIT, SAVED_ROUTES_LIMIT, TRIP_HISTORY_LIMIT } from './limits';
import {
  plannedTrip,
  plannedTripInput,
  recurringTrip,
  recurringTripInput,
  savedRoute,
  savedRouteInput,
  tripRecord,
  tripRecordInput,
} from './trips';

// Corps envoyes par le client : sans proprietaire, le serveur le deduit de la session.
export const tripRecordsInput = z.array(tripRecordInput).max(TRIP_HISTORY_LIMIT);
export const plannedTripsInput = z.array(plannedTripInput).max(PLANNED_LIMIT);
export const recurringTripsInput = z.array(recurringTripInput).max(RECURRING_LIMIT);
export const savedRoutesInput = z.array(savedRouteInput).max(SAVED_ROUTES_LIMIT);

// Collections telles que le serveur les rend, proprietaire compris.
export const tripRecords = z.array(tripRecord);
export const plannedTrips = z.array(plannedTrip);
export const recurringTrips = z.array(recurringTrip);
export const savedRoutes = z.array(savedRoute);
