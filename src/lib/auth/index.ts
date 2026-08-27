// Authentification : inscription, connexion, session et profil.
//
// Deux modes coexistent. Quand l'API repond, elle authentifie et le navigateur
// ne detient qu'un cookie httpOnly. Sinon, le mode autonome prend le relais sur
// le stockage local. Une erreur metier du serveur (email pris, mot de passe
// refuse) remonte telle quelle : seule une panne reseau declenche le repli.
import type { MobilityProfile, SessionUser, StoredUser } from '../../types';
import { isApiOnline } from '../api/availability';
import { ApiUnavailableError } from '../api/errors';
import { apiRequest } from '../api/http';
import type { RemoteState } from '../api/operations';
import { discardOperations, enqueueOperation } from '../api/outbox';
import { cacheSessionUser, clearActiveSession, getActiveSessionId, readCachedSessionUser } from '../api/session';
import { adoptRemoteSession } from '../api/sync';
import { hashPassword, randomBase64 } from './crypto';
import { DEFAULT_PROFILE } from './defaults';
import { ensureDemoAccount, loadUsers, persistSession, persistUsers, toSessionUser } from './storage';
import { clampNumber, normalizeEmail, sanitizeDisplayName, sanitizeModes, validateEmail, validatePassword } from './validation';

export interface AuthInput {
  email: string;
  password: string;
}

export interface RegisterInput extends AuthInput {
  displayName: string;
}

export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  if (isApiOnline()) {
    try {
      const { user } = await apiRequest<{ user: SessionUser; state: RemoteState }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: input.email,
          password: input.password,
          displayName: input.displayName,
        }),
      });
      adoptRemoteSession(user);
      return user;
    } catch (error) {
      // Une erreur metier (email deja pris, mot de passe refuse) doit remonter
      // telle quelle ; seule une panne reseau justifie le repli local.
      if (!(error instanceof ApiUnavailableError)) {
        throw error;
      }
    }
  }

  await ensureDemoAccount();
  const email = normalizeEmail(input.email);
  validateEmail(email);
  validatePassword(input.password);

  const users = loadUsers();
  if (users.some((user) => user.email === email)) {
    throw new Error('Un compte existe deja avec cet email.');
  }

  const salt = randomBase64(16);
  const user: StoredUser = {
    id: crypto.randomUUID(),
    email,
    displayName: sanitizeDisplayName(input.displayName),
    passwordHash: await hashPassword(input.password, salt),
    passwordSalt: salt,
    createdAt: new Date().toISOString(),
    profile: {
      ...DEFAULT_PROFILE,
      displayName: sanitizeDisplayName(input.displayName),
    },
  };

  persistUsers([...users, user]);
  persistSession(user.id);
  return toSessionUser(user);
}

export async function loginUser(input: AuthInput): Promise<SessionUser> {
  if (isApiOnline()) {
    try {
      const { user, state } = await apiRequest<{ user: SessionUser; state: RemoteState }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: input.email, password: input.password }),
      });
      adoptRemoteSession(user, state);
      return user;
    } catch (error) {
      if (!(error instanceof ApiUnavailableError)) {
        throw error;
      }
    }
  }

  await ensureDemoAccount();
  const email = normalizeEmail(input.email);
  const user = loadUsers().find((item) => item.email === email);

  if (!user) {
    throw new Error('Identifiants invalides.');
  }

  const attemptedHash = await hashPassword(input.password, user.passwordSalt);
  if (attemptedHash !== user.passwordHash) {
    throw new Error('Identifiants invalides.');
  }

  persistSession(user.id);
  return toSessionUser(user);
}

export function getCurrentSession(): SessionUser | null {
  const userId = getActiveSessionId();
  if (!userId) {
    return null;
  }

  const remote = readCachedSessionUser();
  if (remote && remote.id === userId) {
    return remote;
  }

  const user = loadUsers().find((item) => item.id === userId);
  return user ? toSessionUser(user) : null;
}

export function logoutUser(): void {
  clearActiveSession();
  if (isApiOnline()) {
    // La session est revoquee cote serveur ; l'echec reseau eventuel ne doit
    // pas empecher la deconnexion locale, deja effectuee ci-dessus.
    void apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
  }
}

export function saveMobilityProfile(userId: string, profile: MobilityProfile): SessionUser {
  const users = loadUsers();
  const index = users.findIndex((user) => user.id === userId);
  const remote = readCachedSessionUser();

  if (index === -1 && (!remote || remote.id !== userId)) {
    throw new Error('Session introuvable.');
  }

  const sanitizedProfile: MobilityProfile = {
    ...profile,
    displayName: sanitizeDisplayName(profile.displayName),
    preferredModes: sanitizeModes(profile.preferredModes),
    maxWalkMinutes: clampNumber(profile.maxWalkMinutes, 5, 45),
    carbonGoalGramsPerWeek: clampNumber(profile.carbonGoalGramsPerWeek, 250, 20000),
    weeklyTripsGoal: clampNumber(profile.weeklyTripsGoal ?? DEFAULT_PROFILE.weeklyTripsGoal ?? 5, 1, 60),
    weeklySavedGoalGrams: clampNumber(profile.weeklySavedGoalGrams ?? DEFAULT_PROFILE.weeklySavedGoalGrams ?? 2000, 100, 50000),
  };

  enqueueOperation(userId, { kind: 'profile.update', profile: sanitizedProfile });

  if (index === -1) {
    const session: SessionUser = {
      ...(remote as SessionUser),
      displayName: sanitizedProfile.displayName,
      profile: sanitizedProfile,
    };
    cacheSessionUser(session);
    return session;
  }

  users[index] = {
    ...users[index],
    displayName: sanitizedProfile.displayName,
    profile: sanitizedProfile,
  };
  persistUsers(users);
  const session = toSessionUser(users[index]);
  if (remote && remote.id === userId) {
    cacheSessionUser(session);
  }
  return session;
}

export function deleteLocalAccount(userId: string): void {
  if (isApiOnline()) {
    // Droit a l'effacement : la demande part aussi au serveur, qui supprime le
    // compte et, en cascade, tous les trajets et itineraires associes.
    void apiRequest('/me', { method: 'DELETE' }).catch(() => undefined);
  }
  // Les operations encore en attente concernent un compte qui n'existe plus.
  discardOperations(userId);
  persistUsers(loadUsers().filter((user) => user.id !== userId));
  clearActiveSession();
  // Droit a l'effacement (RGPD): toutes les cles locales de l'utilisateur sont
  // supprimees par balayage (historique carbone, itineraires sauvegardes,
  // historique de recherche et toute cle future portant l'identifiant).
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
export { loadUsers } from './storage';
