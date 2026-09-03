// Contrat de synchronisation : l'etat complet du compte, tel que le client le
// tient dans son cache local.
//
// Le client n'envoie pas ses mutations une par une : il envoie l'etat entier
// et le serveur le remplace. Rejouer le meme etat apres une reponse perdue
// donne le meme resultat — l'idempotence vient de PUT lui-meme, sans journal
// d'operations a tenir. L'etat est borne (quelques centaines de lignes au
// plus), donc la requete reste petite et son cout previsible.
import { t } from 'elysia';
import { PLANNED_LIMIT, RECURRING_LIMIT, SAVED_ROUTES_LIMIT, TRIP_HISTORY_LIMIT } from '../repositories/limits.ts';
import { mobilityProfile } from './profile.ts';
import { plannedTrip, recurringTrip, savedRoute, tripRecord } from './trips.ts';

/** L'utilisateur n'est jamais transmis : le serveur le deduit de la session. */
export const userStateInput = t.Object({
  profile: mobilityProfile,
  tripRecords: t.Array(tripRecord, { maxItems: TRIP_HISTORY_LIMIT }),
  plannedTrips: t.Array(plannedTrip, { maxItems: PLANNED_LIMIT }),
  recurringTrips: t.Array(recurringTrip, { maxItems: RECURRING_LIMIT }),
  savedRoutes: t.Array(savedRoute, { maxItems: SAVED_ROUTES_LIMIT }),
});

export type UserStateInput = typeof userStateInput.static;
