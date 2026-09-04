// Client Eden Treaty : le type de chaque appel vient directement de l'arbre
// de routes Elysia. Ajouter ou modifier un contrat cote serveur casse donc la
// compilation du front concerne, sans type de reponse recopie ni cast.
import { treaty } from '@elysia/eden';
import type { App } from '../../../server/src/app';
import { REQUEST_TIMEOUT_MS } from './config';
import { ApiError, ApiUnavailableError } from './errors';

// Le domaine vide conserve des URL relatives (`/api/...`) : le serveur sert le
// client sur la meme origine, donc le cookie httpOnly reste de premiere partie.
export const api = treaty<App>('', {
    keepDomain: true,
    fetch: { credentials: 'same-origin' },
    onRequest: (_path, options) =>
        options.signal ? undefined : { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    // Les contrats echangent des dates ISO, pas des instances Date implicites.
    parseDate: false,
}).api;

interface TreatyFailure {
    data: null;
    error: { status: unknown; value: unknown };
    status: number;
}

interface TreatySuccess<T> {
    data: T;
    error: null;
    status: number;
}

type TreatyResult<T> = TreatySuccess<T> | TreatyFailure;

function serverMessage(value: unknown): string | null {
    if (!value || typeof value !== 'object' || !('error' in value)) {
        return null;
    }
    return String(value.error);
}

/** Traduit l'enveloppe Eden vers les erreurs metier deja consommees par l'UI. */
export async function treatyRequest<T>(request: Promise<TreatyResult<T>>): Promise<T> {
    const result = await request;
    if (!result.error) {
        return result.data;
    }

    const message = serverMessage(result.error.value);
    if (result.status === 503 && !message) {
        throw new ApiUnavailableError();
    }
    throw new ApiError(message ?? 'Requete refusee par le serveur.', result.status);
}

/** L'identifiant vient de l'URL et le proprietaire de la session. */
export function resourceBody<T extends { id: string; userId: string }>(record: T): Omit<T, 'id' | 'userId'> {
    const { id, userId, ...body } = record;
    void id;
    void userId;
    return body;
}
