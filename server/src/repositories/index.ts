// Assemblage des dépôts. Un seul point de construction : les plugins et les
// tests reçoivent l'ensemble cohérent, sans jamais instancier un dépôt isole.
//
// L'argument est un `Executor` : la base elle-même, ou une transaction en
// cours. Une transition multi-ressource construit ainsi des dépôts liés à sa
// transaction, sans que les dépôts aient a le savoir.
import type { Executor } from '../db/index.ts';
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
