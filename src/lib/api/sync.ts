// Orchestration de la synchronisation client <-> serveur.
//
// Regle du modele : le serveur fait autorite a la connexion (il hydrate le
// cache local), le client fait autorite entre deux synchronisations (il ecrit
// localement puis rejoue sa file). Compromis assume : l'application reste
// utilisable hors ligne, au prix d'un dernier ecrivain gagnant en cas
// d'edition simultanee sur deux appareils.
import type { SessionUser } from '../../types';
import { isApiOnline, probeApi } from './availability';
import { ApiError, ApiUnavailableError } from './errors';
import { apiRequest } from './http';
import type { RemoteState } from './operations';
import { flushOutbox, pendingOperationCount } from './outbox';
import { cacheSessionUser, setActiveSessionId } from './session';
import { applyRemoteState } from './state';

// Filet de securite : si le navigateur n'emet pas d'evenement "online" (cas
// courant d'un reseau qui repond mais ne route plus), la file est retentee
// periodiquement.
const RETRY_INTERVAL_MS = 60_000;

/** Enregistre la session rendue par le serveur, et son etat s'il l'a joint. */
export function adoptRemoteSession(user: SessionUser, state?: RemoteState): void {
    cacheSessionUser(user);
    setActiveSessionId(user.id);
    if (state) {
        applyRemoteState(user.id, state);
    }
}

/**
 * Demarrage de l'application : sonde le serveur, restaure la session si le
 * cookie est encore valide, puis rejoue les operations en attente.
 * Renvoie l'utilisateur restaure, ou null si l'on reste en mode autonome.
 */
export async function bootstrapSync(): Promise<SessionUser | null> {
    if (!(await probeApi())) {
        return null;
    }

    try {
        const { user, state } = await apiRequest<{ user: SessionUser; state: RemoteState }>('/auth/session');
        adoptRemoteSession(user);

        // La file locale est rejouee avant l'hydratation : les actions faites hors
        // ligne ne doivent pas etre effacees par l'etat serveur.
        await flushOutbox(user.id);
        const refreshed = await apiRequest<RemoteState>('/state').catch(() => state);
        applyRemoteState(user.id, refreshed);

        return user;
    } catch (error) {
        if (error instanceof ApiUnavailableError || (error instanceof ApiError && error.status === 401)) {
            // Pas (ou plus) de session serveur : l'ecran de connexion prend le relais.
            return null;
        }
        throw error;
    }
}

/**
 * Branche la synchronisation d'arriere-plan pour un utilisateur connecte.
 * Renvoie la fonction de detachement a appeler au demontage.
 */
export function startBackgroundSync(userId: string): () => void {
    let stopped = false;

    const attempt = (): void => {
        if (stopped || !isApiOnline() || pendingOperationCount(userId) === 0) {
            return;
        }
        void flushOutbox(userId).catch(() => undefined);
    };

    window.addEventListener('online', attempt);
    // Le retour au premier plan est le moment ou l'utilisateur consulte ses
    // donnees : c'est la que la synchronisation a le plus de valeur.
    document.addEventListener('visibilitychange', attempt);
    const timer = window.setInterval(attempt, RETRY_INTERVAL_MS);
    attempt();

    return () => {
        stopped = true;
        window.removeEventListener('online', attempt);
        document.removeEventListener('visibilitychange', attempt);
        window.clearInterval(timer);
    };
}
