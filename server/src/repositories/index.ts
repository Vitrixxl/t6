// Assemblage des depots. Un seul point de construction : les plugins et les
// tests recoivent l'ensemble coherent, sans jamais instancier un depot isole.
import type { Database } from '../db/index.ts';
import { createOperationLog } from './operations.ts';
import { createPlannedTripRepository } from './planned-trips.ts';
import { createRecurringTripRepository } from './recurring-trips.ts';
import { createSavedRouteRepository } from './saved-routes.ts';
import { createSessionRepository } from './sessions.ts';
import { createStateReader } from './state.ts';
import { createTripRecordRepository } from './trip-records.ts';
import { createUserRepository } from './users.ts';

export function createRepositories(db: Database) {
  const tripRecords = createTripRecordRepository(db);
  const plannedTrips = createPlannedTripRepository(db);
  const recurringTrips = createRecurringTripRepository(db);
  const savedRoutes = createSavedRouteRepository(db);

  return {
    users: createUserRepository(db),
    sessions: createSessionRepository(db),
    operations: createOperationLog(db),
    tripRecords,
    plannedTrips,
    recurringTrips,
    savedRoutes,
    state: createStateReader({ tripRecords, plannedTrips, recurringTrips, savedRoutes }),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export { toSessionUser } from './mappers.ts';
export type { UserRow } from './mappers.ts';
export type { UserState } from './state.ts';
