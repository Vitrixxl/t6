// Point d'entree de la couche API : le reste de l'application importe d'ici.
export { API_BASE } from './config';
export { discardPending, hasPending, markDirty } from './dirty';
export { ApiError, ApiUnavailableError } from './errors';
export { apiRequest } from './http';
export { clearActiveSession, getActiveSessionId, readCachedSessionUser } from './session';
export { applyRemoteState, readLocalState } from './state';
export type { LocalState, RemoteState } from './state';
export { adoptRemoteSession, bootstrapSync, pushState, startBackgroundSync } from './sync';
