// Commandes des itineraires sauvegardes. L'elagage conserve les plus recents
// sans jamais supprimer/reinserer la collection complete.
import type { Db } from '../db/index.ts';
import { createRepositories } from '../repositories/index.ts';
import type { SavedRouteRecord } from '../../../src/contracts/index.ts';

export function saveSavedRoute(db: Db, record: SavedRouteRecord): SavedRouteRecord | null {
  return db.transaction((tx) => {
    const repository = createRepositories(tx).savedRoutes;
    repository.upsert(record);
    repository.prune(record.userId);
    return repository.findById(record.userId, record.id);
  });
}

export function deleteSavedRoute(db: Db, userId: string, id: string): void {
  createRepositories(db).savedRoutes.deleteById(userId, id);
}
