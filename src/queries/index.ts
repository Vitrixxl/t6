// Données servies par l'API, tenues dans le cache de requêtes (React Query).
// Une ressource par fichier : sa requête, ses actions. Les composants
// importent d'ici ; l'état d'écran, lui, vit dans src/state/.
export { createQueryClient } from './client';
export { useDeleteAccount, useLogin, useLogout, useRegister, useSession } from './session';
export { useUser } from './user';
export { useProfile, useUpdateProfile } from './profile';
export { useRestoreTrip, useCancelTrip, usePlanTrip, usePlannedTrips, useRemoveTrip, useUpcomingTrips } from './planned-trips';
export { useRestoreRoutinePassage, useCancelRoutineDate, useCreateRoutine, useRecurringTrips, useRemoveRoutine, useToggleRoutinePaused, type RoutineSchedule } from './recurring-trips';
export { useClearTripHistory, useTripRecords } from './trip-records';
export { useDeleteSavedRoute, useSaveRoute, useSavedRoutes, type SaveRouteInput } from './saved-routes';
export { useActivitySummary, useCarbonSummary } from './summaries';
export { useSaveError } from './save-error';
export { useTransportContext } from './transport';
export { routeOptionsQuery, type RouteSearch } from './routes';
export { useExportAccount } from './account-export';
