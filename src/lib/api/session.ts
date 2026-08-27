// Etat de session cote navigateur : identifiant de l'onglet courant et copie
// du compte authentifie. Ce module ne contient volontairement aucune logique
// metier : il est la couche partagee entre l'authentification et la
// synchronisation, ce qui evite un cycle d'imports entre les deux.
import type { SessionUser } from '../../types';

// L'identifiant de session vit dans sessionStorage : il disparait a la
// fermeture de l'onglet, alors que le cookie serveur, lui, reste valable.
const ACTIVE_SESSION_KEY = 'ufm.session';
// Copie locale du compte authentifie : rend l'interface immediatement au
// rechargement, et garde l'application utilisable si le serveur tombe.
const CACHED_USER_KEY = 'ufm.session.remote';

export function getActiveSessionId(): string | null {
  return sessionStorage.getItem(ACTIVE_SESSION_KEY);
}

export function setActiveSessionId(userId: string): void {
  sessionStorage.setItem(ACTIVE_SESSION_KEY, userId);
}

export function clearActiveSession(): void {
  sessionStorage.removeItem(ACTIVE_SESSION_KEY);
  localStorage.removeItem(CACHED_USER_KEY);
}

export function readCachedSessionUser(): SessionUser | null {
  const payload = localStorage.getItem(CACHED_USER_KEY);
  if (!payload) {
    return null;
  }
  try {
    return JSON.parse(payload) as SessionUser;
  } catch {
    localStorage.removeItem(CACHED_USER_KEY);
    return null;
  }
}

export function cacheSessionUser(user: SessionUser): void {
  localStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
}
