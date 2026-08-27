// Contrat des operations de synchronisation, cote client.
//
// Il reproduit le schema TypeBox du serveur (server/src/models/sync.ts). Les
// deux vivent dans des runtimes differents ; ce type est la trace explicite du
// contrat, et toute divergence est rattrapee par les tests d'integration qui
// rejouent une operation reelle contre l'API.
import type {
  MobilityProfile,
  PlannedTrip,
  RecurringTrip,
  SavedRouteRecord,
  TripRecord,
} from '../../types';

/** L'utilisateur n'est jamais transmis : le serveur le deduit de la session. */
export type OperationPayload =
  | { kind: 'profile.update'; profile: MobilityProfile }
  | { kind: 'trip.record'; record: Omit<TripRecord, 'userId'> }
  | { kind: 'trip.history.clear' }
  | { kind: 'planned.upsert'; trip: Omit<PlannedTrip, 'userId'> }
  | { kind: 'planned.delete'; tripId: string }
  | { kind: 'recurring.upsert'; trip: Omit<RecurringTrip, 'userId'> }
  | { kind: 'recurring.delete'; tripId: string }
  | { kind: 'saved.upsert'; record: Omit<SavedRouteRecord, 'userId'> }
  | { kind: 'saved.delete'; recordId: string };

/** Etat complet d'un compte, tel que le serveur le renvoie. */
export interface RemoteState {
  profile: MobilityProfile;
  tripRecords: TripRecord[];
  plannedTrips: PlannedTrip[];
  recurringTrips: RecurringTrip[];
  savedRoutes: SavedRouteRecord[];
}
