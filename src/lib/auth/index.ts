// Authentification : inscription, connexion, deconnexion, effacement, profil.
//
// Le serveur authentifie et detient l'etat. Le navigateur ne garde qu'un
// cookie httpOnly ; l'etat du compte lui est rendu a chaque ouverture de
// session et vit en memoire le temps de celle-ci.
import type { MobilityProfile } from '../../types';
import type { Session } from '../api/account';
import { apiRequest } from '../api/http';
import { DEFAULT_PROFILE } from './defaults';
import { clampNumber, sanitizeDisplayName, sanitizeModes } from './validation';

export interface AuthInput {
  email: string;
  password: string;
}

export interface RegisterInput extends AuthInput {
  displayName: string;
}

export function registerUser(input: RegisterInput): Promise<Session> {
  return apiRequest<Session>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email: input.email.trim(), password: input.password, displayName: input.displayName }),
  });
}

export function loginUser(input: AuthInput): Promise<Session> {
  return apiRequest<Session>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: input.email.trim(), password: input.password }),
  });
}

export function logoutUser(): void {
  // La session est revoquee cote serveur ; un echec reseau ne doit pas
  // empecher de quitter l'ecran, le cookie expirera de lui-meme.
  void apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
}

/** Droit a l'effacement (RGPD art. 17) : le serveur supprime tout en cascade. */
export async function deleteAccount(): Promise<void> {
  await apiRequest('/me', { method: 'DELETE' });
}

/**
 * Bornes identiques a celles du schema serveur : le retour est immediat pour
 * l'utilisateur, et le serveur n'a rien a refuser a l'envoi.
 */
export function sanitizeProfile(profile: MobilityProfile): MobilityProfile {
  return {
    ...profile,
    displayName: sanitizeDisplayName(profile.displayName),
    preferredModes: sanitizeModes(profile.preferredModes),
    maxWalkMinutes: clampNumber(profile.maxWalkMinutes, 5, 45),
    carbonGoalGramsPerWeek: clampNumber(profile.carbonGoalGramsPerWeek, 250, 20000),
    weeklyTripsGoal: clampNumber(profile.weeklyTripsGoal ?? DEFAULT_PROFILE.weeklyTripsGoal ?? 5, 1, 60),
    weeklySavedGoalGrams: clampNumber(profile.weeklySavedGoalGrams ?? DEFAULT_PROFILE.weeklySavedGoalGrams ?? 2000, 100, 50000),
  };
}

export { DEFAULT_PROFILE } from './defaults';
