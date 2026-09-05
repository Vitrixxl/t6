// Commandes des itinéraires sauvegardes. L'elagage conserve les plus récents
// sans jamais supprimer/reinserer la collection complète.
import type { Db } from '../db/index.ts';
import { createSavedRouteRepository } from '../repositories/saved-routes.ts';
import type { SavedRouteRecord } from '../../../src/contracts/index.ts';

export function saveSavedRoute(db: Db, record: SavedRouteRecord): SavedRouteRecord | null {
    return db.transaction((tx) => {
        const repository = createSavedRouteRepository(tx);
        repository.upsert(record);
        repository.prune(record.userId);
        return repository.findById(record.userId, record.id);
    });
}
