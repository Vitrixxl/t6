// Commandes des itinéraires sauvegardes. L'elagage conserve les plus récents
// sans jamais supprimer/reinserer la collection complète.
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
