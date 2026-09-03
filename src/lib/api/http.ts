// Client HTTP de l'API UrbanFlow : une seule porte de sortie vers le serveur.
// Delai maximal et format d'erreur y sont centralises.
import { API_BASE, REQUEST_TIMEOUT_MS } from './config';
import { ApiError, ApiUnavailableError } from './errors';

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      // Le cookie de session est httpOnly et de meme origine : aucun jeton
      // n'est manipule en JavaScript, donc rien a voler via une injection.
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiUnavailableError();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : 'Requete refusee par le serveur.';
    throw new ApiError(message, response.status);
  }

  return payload as T;
}
