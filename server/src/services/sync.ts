// Application des operations de synchronisation.
//
// La regle metier vit ici, pas dans le gestionnaire HTTP : la route valide,
// ouvre une transaction et delegue. On peut donc tester le comportement de
// synchronisation sans requete HTTP, et rebrancher la meme logique sur un
// autre transport (file de messages, tache planifiee) sans la reecrire.
import type { MobilityProfile } from '../../../src/types.ts';
import type { Operation } from '../models/sync.ts';
import type { Repositories } from '../repositories/index.ts';

export interface SyncOutcome {
  applied: number;
  ignored: number;
}

function apply(repositories: Repositories, userId: string, operation: Operation): void {
  const { users, tripRecords, plannedTrips, recurringTrips, savedRoutes } = repositories;

  switch (operation.kind) {
    case 'profile.update':
      users.updateProfile(userId, operation.profile as MobilityProfile);
      return;
    case 'trip.record':
      tripRecords.insert(userId, operation.record);
      return;
    case 'trip.history.clear':
      tripRecords.clear(userId);
      return;
    case 'planned.upsert':
      plannedTrips.upsert(userId, operation.trip);
      return;
    case 'planned.delete':
      plannedTrips.delete(userId, operation.tripId);
      return;
    case 'recurring.upsert':
      recurringTrips.upsert(userId, operation.trip);
      return;
    case 'recurring.delete':
      // Regle metier : une routine emporte les occurrences qu'elle a
      // engendrees. Le client envoie une seule intention, le serveur en tire
      // les consequences - pas d'orphelin en base.
      plannedTrips.deleteByRecurring(userId, operation.tripId);
      recurringTrips.delete(userId, operation.tripId);
      return;
    case 'saved.upsert':
      savedRoutes.upsert(userId, operation.record);
      return;
    case 'saved.delete':
      savedRoutes.delete(userId, operation.recordId);
      return;
  }
}

/**
 * Applique un lot d'operations. A appeler dans une transaction : soit tout
 * passe, soit la base reste dans son etat initial, et le client peut rejouer
 * le lot entier sans avoir a deviner ou il s'est arrete.
 */
export function applyOperations(repositories: Repositories, userId: string, batch: Operation[]): SyncOutcome {
  const now = new Date();
  let applied = 0;
  let ignored = 0;

  for (const operation of batch) {
    // Une operation deja connue est ignoree, pas rejouee : c'est ce qui rend
    // la file d'attente du client sure apres une reponse perdue.
    if (repositories.operations.alreadyApplied(userId, operation.id)) {
      ignored += 1;
      continue;
    }
    apply(repositories, userId, operation);
    repositories.operations.record(userId, operation.id, operation.kind, now.toISOString());
    applied += 1;
  }

  repositories.operations.purgeOlderThan(now);
  return { applied, ignored };
}
