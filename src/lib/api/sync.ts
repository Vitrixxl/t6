// Orchestration de la synchronisation client <-> serveur.
//
// Regle du modele : le serveur fait autorite a la connexion (il hydrate le
// cache local), le client fait autorite entre deux synchronisations (il ecrit
// localement, puis envoie son etat complet). Compromis assume : l'application
// reste utilisable pendant une coupure reseau, au prix d'un dernier ecrivain
// gagnant en cas d'edition simultanee sur deux appareils.
import type { SessionUser } from '../../types';
import { DIRTY_EVENT, clearDirty, hasPending, readDirty } from './dirty';
import { ApiError, ApiUnavailableError } from './errors';
import { apiRequest } from './http';
import { cacheSessionUser, readCachedSessionUser, setActiveSessionId } from './session';
import { applyRemoteState, readLocalState, type RemoteState } from './state';

// Filet de securite : si le navigateur n'emet pas d'evenement "online" (cas
// courant d'un reseau qui repond mais ne route plus), l'envoi est retente
// periodiquement.
const RETRY_INTERVAL_MS = 60_000;

// Une action de l'utilisateur en entraine souvent plusieurs (planifier une
// routine ecrit la routine puis ses occurrences) : on attend que la rafale
// retombe avant d'envoyer, plutot qu'un PUT par ecriture.
const PUSH_DEBOUNCE_MS = 1_500;

export type PushOutcome = 'clean' | 'pushed' | 'pending';

/**
 * Envoie l'etat local s'il est en avance sur le serveur. PUT est idempotent :
 * un envoi rejoue apres une reponse perdue donne le meme resultat.
 */
export async function pushState(userId: string): Promise<PushOutcome> {
  const mark = readDirty();
  if (!mark || mark.userId !== userId) {
    return 'clean';
  }
  const user = readCachedSessionUser();
  if (!user || user.id !== userId) {
    return 'pending';
  }

  try {
    await apiRequest('/state', { method: 'PUT', body: JSON.stringify(readLocalState(user)) });
  } catch (error) {
    if (error instanceof ApiUnavailableError || (error instanceof ApiError && error.status === 401)) {
      // Coupure reseau ou session expiree : rien n'est perdu, la prochaine
      // tentative (ou la reconnexion) renverra l'etat.
      return 'pending';
    }
    if (error instanceof ApiError) {
      // Etat refuse par la validation serveur : le renvoyer indefiniment ne
      // changerait rien. On le signale et on cesse d'insister ; la prochaine
      // ecriture locale relancera un envoi.
      console.error('Etat local refuse par le serveur, envoi abandonne.', error.message);
      clearDirty(mark);
      return 'clean';
    }
    throw error;
  }

  // Une ecriture faite pendant la requete a renouvele la marque : elle reste.
  clearDirty(mark);
  return hasPending(userId) ? 'pending' : 'pushed';
}

/**
 * Enregistre la session rendue par le serveur, et son etat s'il l'a joint.
 * Un etat local encore a envoyer n'est pas ecrase : il est en avance sur le
 * serveur, c'est lui qui partira a la prochaine synchronisation.
 */
export function adoptRemoteSession(user: SessionUser, state?: RemoteState): void {
  cacheSessionUser(user);
  setActiveSessionId(user.id);
  if (state && !hasPending(user.id)) {
    applyRemoteState(user.id, state);
  }
}

/**
 * Demarrage de l'application : restaure la session si le cookie est encore
 * valide, puis envoie l'etat local s'il etait en attente. Renvoie l'utilisateur
 * restaure, ou null s'il faut passer par l'ecran de connexion.
 */
export async function bootstrapSync(): Promise<SessionUser | null> {
  try {
    const { user, state } = await apiRequest<{ user: SessionUser; state: RemoteState }>('/auth/session');
    adoptRemoteSession(user, state);
    await pushState(user.id);
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
    if (stopped || !hasPending(userId)) {
      return;
    }
    void pushState(userId).catch(() => undefined);
  };

  let debounce: number | null = null;
  const attemptSoon = (): void => {
    if (debounce !== null) {
      window.clearTimeout(debounce);
    }
    debounce = window.setTimeout(attempt, PUSH_DEBOUNCE_MS);
  };

  window.addEventListener(DIRTY_EVENT, attemptSoon);
  window.addEventListener('online', attempt);
  // Le retour au premier plan est le moment ou l'utilisateur consulte ses
  // donnees : c'est la que la synchronisation a le plus de valeur.
  document.addEventListener('visibilitychange', attempt);
  const timer = window.setInterval(attempt, RETRY_INTERVAL_MS);
  attempt();

  return () => {
    stopped = true;
    if (debounce !== null) {
      window.clearTimeout(debounce);
    }
    window.removeEventListener(DIRTY_EVENT, attemptSoon);
    window.removeEventListener('online', attempt);
    document.removeEventListener('visibilitychange', attempt);
    window.clearInterval(timer);
  };
}
