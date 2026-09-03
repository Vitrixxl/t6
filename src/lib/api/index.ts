// Point d'entree de la couche API : le reste de l'application importe d'ici.
export { API_BASE } from './config';
export { restoreSession, saveAccountPart, saveAccountParts } from './account';
export type { AccountPart, AccountState, Session } from './account';
export { ApiError, ApiUnavailableError } from './errors';
export { apiRequest } from './http';
