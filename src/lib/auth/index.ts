// Authentification : inscription, connexion, session et profil.
//
// Le serveur authentifie. Le navigateur ne detient qu'un cookie httpOnly et
// une copie du compte, qui sert a rendre l'interface sans attendre le reseau.
// Il n'y a pas de repli sans serveur : c'est l'API qui sert le client, une
// API absente est une page absente.
import type { MobilityProfile, SessionUser } from '../../types';
import { discardPending, markDirty } from '../api/dirty';
import { apiRequest } from '../api/http';
import { cacheSessionUser, clearActiveSession, getActiveSessionId, readCachedSessionUser } from '../api/session';
import type { RemoteState } from '../api/state';
import { adoptRemoteSession } from '../api/sync';
import { DEFAULT_PROFILE } from './defaults';
import { clampNumber, sanitizeDisplayName, sanitizeModes } from './validation';

export interface AuthInput {
  email: string;
  password: string;
}

export interface RegisterInput extends AuthInput {
  displayName: string;
}

interface AuthResponse {
  user: SessionUser;
  state: RemoteState;
}

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const { user, state } = await apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: input.email.trim(), password: input.password, displayName: input.displayName }),
  });
  adoptRemoteSession(user, state);
  return user;
}

export async function loginUser(input: AuthInput): Promise<SessionUser> {
  const { user, state } = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: input.email.trim(), password: input.password }),
  });
  adoptRemoteSession(user, state);
  return user;
}

/** Compte de l'onglet courant, d'apres la copie locale. Le serveur tranche au demarrage. */
export function getCurrentSession(): SessionUser | null {
  const userId = getActiveSessionId();
  const cached = readCachedSessionUser();
  return userId && cached && cached.id === userId ? cached : null;
}

export function logoutUser(): void {
  clearActiveSession();
  // La session est revoquee cote serveur ; l'echec reseau eventuel ne doit
  // pas empecher la deconnexion locale, deja effectuee ci-dessus.
  void apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
}

export function saveMobilityProfile(userId: string, profile: MobilityProfile): SessionUser {
  const cached = readCachedSessionUser();
  if (!cached || cached.id !== userId) {
    throw new Error('Session introuvable.');
  }

  // Bornes identiques a celles du schema serveur : le retour est immediat
  // pour l'utilisateur, et le serveur n'a rien a refuser au rejeu.
  const sanitizedProfile: MobilityProfile = {
    ...profile,
    displayName: sanitizeDisplayName(profile.displayName),
    preferredModes: sanitizeModes(profile.preferredModes),
    maxWalkMinutes: clampNumber(profile.maxWalkMinutes, 5, 45),
    carbonGoalGramsPerWeek: clampNumber(profile.carbonGoalGramsPerWeek, 250, 20000),
    weeklyTripsGoal: clampNumber(profile.weeklyTripsGoal ?? DEFAULT_PROFILE.weeklyTripsGoal ?? 5, 1, 60),
    weeklySavedGoalGrams: clampNumber(profile.weeklySavedGoalGrams ?? DEFAULT_PROFILE.weeklySavedGoalGrams ?? 2000, 100, 50000),
  };

  const session: SessionUser = { ...cached, displayName: sanitizedProfile.displayName, profile: sanitizedProfile };
  cacheSessionUser(session);
  markDirty(userId);
  return session;
}

/** Droit a l'effacement (RGPD art. 17) : serveur en cascade, puis tout le local. */
export function deleteAccount(userId: string): void {
  void apiRequest('/me', { method: 'DELETE' }).catch(() => undefined);
  // Un etat encore a envoyer concerne un compte qui n'existe plus.
  discardPending(userId);
  clearActiveSession();
  // Toutes les cles locales de l'utilisateur sont supprimees par balayage :
  // historique carbone, itineraires sauvegardes, trajets, et toute cle future
  // portant l'identifiant.
  const userKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.includes(userId)) {
      userKeys.push(key);
    }
  }
  userKeys.forEach((key) => localStorage.removeItem(key));
}

export { DEFAULT_PROFILE } from './defaults';
