// Données servies par l'API, tenues dans le cache de requêtes (React Query).
// Une ressource par fichier : sa requête, ses actions. Les composants
// importent d'ici ; l'état d'écran, lui, vit dans src/state/.
export { createQueryClient } from './client';
export { useDeleteAccount, useLogin, useLogout, useRegister, useSession } from './session';
export { useUser } from './user';
export { useProfile, useUpdateProfile } from './profile';
export { useCancelTrip, useMarkTripDone, usePlanTrip, usePlannedTrips, useRemoveTrip, useUpcomingTrips } from './planned-trips';
export { useCreateRoutine, useRecurringTrips, useRemoveRoutine, useToggleRoutinePaused, type RoutineSchedule } from './recurring-trips';
export { useClearTripHistory, useTripRecords } from './trip-records';
export { useDeleteSavedRoute, useSaveRoute, useSavedRoutes, type SaveRouteInput } from './saved-routes';
export { useActivitySummary, useCarbonSummary } from './summaries';
export { useSaveError } from './save-error';
export { useTransportNetwork } from './transport';
export { measuredRoutesQuery, type RouteSearch } from './routes';
