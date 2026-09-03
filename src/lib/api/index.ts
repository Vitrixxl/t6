// Point d'entree de la couche API : le reste de l'application importe d'ici.
export { API_BASE } from './config';
export { ApiError, ApiUnavailableError } from './errors';
export { apiRequest } from './http';
export type { OperationPayload, RemoteState } from './operations';
export { discardOperations, enqueueOperation, flushOutbox, pendingOperationCount } from './outbox';
export { clearActiveSession, getActiveSessionId, readCachedSessionUser } from './session';
export { applyRemoteState } from './state';
export { adoptRemoteSession, bootstrapSync, startBackgroundSync } from './sync';
