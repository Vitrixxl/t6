// Assemblage des depots. Un seul point de construction : les plugins et les
// tests recoivent l'ensemble coherent, sans jamais instancier un depot isole.
//
// L'argument est un `Executor` : la base elle-meme, ou une transaction en
// cours. Un lot de synchronisation se construit ainsi des depots lies a sa
// transaction, sans que les depots aient a le savoir.
import type { Executor } from '../db/index.ts';
import { createOperationLog } from './operations.ts';
import { createPlannedTripRepository } from './planned-trips.ts';
import { createRecurringTripRepository } from './recurring-trips.ts';
import { createRouteCacheRepository } from './route-cache.ts';
import { createSavedRouteRepository } from './saved-routes.ts';
import { createSessionRepository } from './sessions.ts';
import { createStateReader } from './state.ts';
import { createTripRecordRepository } from './trip-records.ts';
import { createUserRepository } from './users.ts';

export function createRepositories(db: Executor) {
  const tripRecords = createTripRecordRepository(db);
  const plannedTrips = createPlannedTripRepository(db);
  const recurringTrips = createRecurringTripRepository(db);
  const savedRoutes = createSavedRouteRepository(db);

  return {
    users: createUserRepository(db),
    routeCache: createRouteCacheRepository(db),
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
export type { NewUserRow, UserRow } from './mappers.ts';
export type { UserState } from './state.ts';
