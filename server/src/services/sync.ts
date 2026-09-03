// Remplacement de l'etat d'un compte.
//
// La regle metier vit ici, pas dans le gestionnaire HTTP : la route valide,
// ouvre une transaction et delegue. Le client fait autorite sur son etat entre
// deux synchronisations ; le serveur remplace table par table. Appele dans une
// transaction : soit tout passe, soit la base reste dans son etat initial.
//
// Compromis assume : dernier ecrivain gagnant, a l'echelle du compte. Deux
// appareils qui ecrivent en meme temps se resolvent par le dernier arrive —
// c'est le prix d'une application utilisable pendant une coupure reseau, et
// la granularite par ligne n'y changerait rien.
import type { MobilityProfile } from '../../../src/types.ts';
import type { UserStateInput } from '../models/sync.ts';
import type { Repositories } from '../repositories/index.ts';

export function replaceState(repositories: Repositories, userId: string, state: UserStateInput): void {
  repositories.users.updateProfile(userId, state.profile as MobilityProfile);
  repositories.tripRecords.replaceAll(userId, state.tripRecords);
  repositories.plannedTrips.replaceAll(userId, state.plannedTrips);
  repositories.recurringTrips.replaceAll(userId, state.recurringTrips);
  repositories.savedRoutes.replaceAll(userId, state.savedRoutes);
}
