// Vue agregee de l'etat d'un compte.
//
// Les depots restent specialises par table ; cette facade compose la reponse
// unique attendue par le client au moment de l'hydratation, pour qu'aucune
// route n'ait a connaitre la liste des depots a interroger.
import type { MobilityProfile, PlannedTrip, RecurringTrip, SavedRouteRecord, TripRecord } from '../../../src/types.ts';
import type { PlannedTripRepository } from './planned-trips.ts';
import type { RecurringTripRepository } from './recurring-trips.ts';
import type { SavedRouteRepository } from './saved-routes.ts';
import type { TripRecordRepository } from './trip-records.ts';

export interface UserState {
  profile: MobilityProfile;
  tripRecords: TripRecord[];
  plannedTrips: PlannedTrip[];
  recurringTrips: RecurringTrip[];
  savedRoutes: SavedRouteRecord[];
}

export interface StateSources {
  tripRecords: TripRecordRepository;
  plannedTrips: PlannedTripRepository;
  recurringTrips: RecurringTripRepository;
  savedRoutes: SavedRouteRepository;
}

export function createStateReader(sources: StateSources) {
  return {
    fullState(userId: string, profile: MobilityProfile): UserState {
      return {
        profile,
        tripRecords: sources.tripRecords.list(userId),
        plannedTrips: sources.plannedTrips.list(userId),
        recurringTrips: sources.recurringTrips.list(userId),
        savedRoutes: sources.savedRoutes.list(userId),
      };
    },
  };
}
