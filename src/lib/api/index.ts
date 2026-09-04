// Point d'entree de la couche API : le reste de l'application importe d'ici.
export { API_BASE } from './config';
export { ACCOUNT_PARTS, accountPartsOf, fetchAccountPart, restoreSession, saveAccountPart, saveAccountParts } from './account';
export type { AccountPart, AccountState, Session } from './account';
export { deleteAccount, loginUser, logoutUser, registerUser } from './auth';
export { ApiError, ApiUnavailableError } from './errors';
export { apiRequest } from './http';
