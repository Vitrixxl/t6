// Contrat de la file de synchronisation.
//
// Le client hors ligne empile des intentions ("enregistre ce trajet",
// "supprime cette routine") plutot que d'envoyer l'etat entier : le lot reste
// petit, et le serveur sait exactement ce qui a change.
import { t } from 'elysia';
import { identifier } from './primitives.ts';
import { mobilityProfile } from './profile.ts';
import { plannedTrip, recurringTrip, savedRoute, tripRecord } from './trips.ts';

// Chaque operation porte son propre identifiant : le serveur s'en sert pour
// ignorer les rejeux de la file d'attente apres une reponse perdue.
const envelope = { id: t.String({ format: 'uuid' }), at: t.String({ format: 'date-time' }) };

export const operation = t.Union([
  t.Object({ ...envelope, kind: t.Literal('profile.update'), profile: mobilityProfile }),
  t.Object({ ...envelope, kind: t.Literal('trip.record'), record: tripRecord }),
  t.Object({ ...envelope, kind: t.Literal('trip.history.clear') }),
  t.Object({ ...envelope, kind: t.Literal('planned.upsert'), trip: plannedTrip }),
  t.Object({ ...envelope, kind: t.Literal('planned.delete'), tripId: identifier }),
  t.Object({ ...envelope, kind: t.Literal('recurring.upsert'), trip: recurringTrip }),
  t.Object({ ...envelope, kind: t.Literal('recurring.delete'), tripId: identifier }),
  t.Object({ ...envelope, kind: t.Literal('saved.upsert'), record: savedRoute }),
  t.Object({ ...envelope, kind: t.Literal('saved.delete'), recordId: identifier }),
]);

/** Nombre maximal d'operations par lot : un client ne peut pas imposer un
 *  travail illimite au serveur en une seule requete. */
export const OPERATION_BATCH_LIMIT = 200;

export const operationBatch = t.Object({
  operations: t.Array(operation, { minItems: 1, maxItems: OPERATION_BATCH_LIMIT }),
});

export const operationOutcome = t.Object({
  applied: t.Integer(),
  ignored: t.Integer(),
});

export type Operation = typeof operation.static;
