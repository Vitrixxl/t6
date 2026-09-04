// Commandes des routines. La borne est verifiee cote serveur : un second
// appareil ne peut pas la contourner avec une vue locale perimee.
import type { Db } from '../db/index.ts';
import { createRepositories } from '../repositories/index.ts';
import { RECURRING_LIMIT, type RecurringTrip } from '../../../src/contracts/index.ts';

export function saveRecurringTrip(db: Db, trip: RecurringTrip): RecurringTrip | null {
  return db.transaction((tx) => {
    const repository = createRepositories(tx).recurringTrips;
    if (!repository.findById(trip.userId, trip.id) && repository.count(trip.userId) >= RECURRING_LIMIT) {
      return null;
    }
    repository.upsert(trip);
    return repository.findById(trip.userId, trip.id);
  });
}

export function deleteRecurringTrip(db: Db, userId: string, id: string): void {
  createRepositories(db).recurringTrips.deleteById(userId, id);
}
