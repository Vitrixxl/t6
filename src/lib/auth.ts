import type { MobilityMode, MobilityProfile, SessionUser, StoredUser } from '../types';
import { isApiOnline } from './api/availability';
import { ApiUnavailableError } from './api/errors';
import { apiRequest } from './api/http';
import type { RemoteState } from './api/operations';
import { discardOperations, enqueueOperation } from './api/outbox';
import {
  cacheSessionUser,
  clearActiveSession,
  getActiveSessionId,
  readCachedSessionUser,
  setActiveSessionId,
} from './api/session';
import { adoptRemoteSession } from './api/sync';

const USERS_KEY = 'ufm.users';
const DEMO_EMAIL = 'demo@urbanflow.local';
const DEMO_PASSWORD = 'UrbanFlow2026!';

export const DEFAULT_PROFILE: MobilityProfile = {
  displayName: 'Citoyen UrbanFlow',
  preferredModes: ['transit', 'bike', 'walk'],
  maxWalkMinutes: 15,
  accessibilityNeed: false,
  avoidRain: true,
  carbonGoalGramsPerWeek: 2500,
  weeklyTripsGoal: 5,
  weeklySavedGoalGrams: 2000,
};

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

export function loadUsers(): StoredUser[] {
  const payload = localStorage.getItem(USERS_KEY);
  if (!payload) {
    return [];
  }

  try {
    return JSON.parse(payload) as StoredUser[];
  } catch {
    localStorage.removeItem(USERS_KEY);
    return [];
  }
}

async function ensureDemoAccount(): Promise<void> {
  const users = loadUsers();
  if (users.some((user) => user.email === DEMO_EMAIL)) {
    return;
  }

  const salt = randomBase64(16);
  const demoUser: StoredUser = {
    id: 'demo-urbanflow-user',
    email: DEMO_EMAIL,
    displayName: 'Demo UrbanFlow',
    passwordHash: await hashPassword(DEMO_PASSWORD, salt),
    passwordSalt: salt,
    createdAt: new Date('2026-09-01T08:00:00+02:00').toISOString(),
    profile: {
      ...DEFAULT_PROFILE,
      displayName: 'Demo UrbanFlow',
      preferredModes: ['transit', 'bike', 'walk'],
      accessibilityNeed: false,
      carbonGoalGramsPerWeek: 2500,
    },
  };

  persistUsers([demoUser, ...users]);
}

function persistUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function persistSession(userId: string): void {
  setActiveSessionId(userId);
}

function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    profile: user.profile,
  };
}

function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email invalide.');
  }
}

function validatePassword(password: string): void {
  if (password.length < 12 || !/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Mot de passe requis: 12 caracteres minimum avec lettres et chiffres.');
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeDisplayName(value: string): string {
  const sanitized = value.trim().replace(/[<>]/g, '').slice(0, 80);
  return sanitized || DEFAULT_PROFILE.displayName;
}

function sanitizeModes(modes: MobilityMode[]): MobilityMode[] {
  const allowed: MobilityMode[] = ['walk', 'bike', 'scooter', 'transit', 'carpool'];
  const sanitized = modes.filter((mode, index) => allowed.includes(mode) && modes.indexOf(mode) === index);
  return sanitized.length > 0 ? sanitized : DEFAULT_PROFILE.preferredModes;
}

function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}

async function hashPassword(password: string, saltBase64: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = toArrayBuffer(base64ToBytes(saltBase64));
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 120000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  return bytesToBase64(new Uint8Array(derivedBits));
}

function randomBase64(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
