// Stockage local des comptes du mode autonome, et compte de demonstration.
//
// Ce stockage n'est une source de verite que sans serveur : des que l'API
// repond, il devient un cache alimente par elle.
import type { SessionUser, StoredUser } from '../../types';
import { hashPassword, randomBase64 } from './crypto';
import { DEFAULT_PROFILE } from './defaults';
import { setActiveSessionId } from '../api/session';

const USERS_KEY = 'ufm.users';
const DEMO_EMAIL = 'demo@urbanflow.local';
const DEMO_PASSWORD = 'UrbanFlow2026!';


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

export async function ensureDemoAccount(): Promise<void> {
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

export function persistUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function persistSession(userId: string): void {
  setActiveSessionId(userId);
}

export function toSessionUser(user: StoredUser): SessionUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    profile: user.profile,
  };
}
