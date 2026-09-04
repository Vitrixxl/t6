// Point d'entree de la couche API : le reste de l'application importe d'ici.
export { ACCOUNT_PARTS, fetchAccountPart, restoreSession } from './account';
export { completePlannedTrip, deletePlannedTrip, savePlannedTrip } from './planned-trips';
export { deleteRecurringTrip, saveRecurringTrip } from './recurring-trips';
export { deleteSavedRoute, saveSavedRoute } from './saved-routes';
export { clearTripHistory } from './trip-history';
export { saveProfile } from './profile';
export type { AccountPart, AccountState, Session } from './account';
export { deleteAccount, loginUser, logoutUser, registerUser } from './auth';
export { ApiError, ApiUnavailableError } from './errors';
