// Validation et normalisation des saisies du mode autonome. Les memes regles
// sont appliquees cote serveur par les schemas TypeBox : ici elles servent le
// retour immediat a l'utilisateur, la ou le serveur, lui, fait autorite.
import type { MobilityMode } from '../../types';
import { DEFAULT_PROFILE } from './defaults';

export function validateEmail(email: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email invalide.');
  }
}

export function validatePassword(password: string): void {
  if (password.length < 12 || !/[a-z]/i.test(password) || !/[0-9]/.test(password)) {
    throw new Error('Mot de passe requis: 12 caracteres minimum avec lettres et chiffres.');
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizeDisplayName(value: string): string {
  const sanitized = value.trim().replace(/[<>]/g, '').slice(0, 80);
  return sanitized || DEFAULT_PROFILE.displayName;
}

export function sanitizeModes(modes: MobilityMode[]): MobilityMode[] {
  const allowed: MobilityMode[] = ['walk', 'bike', 'scooter', 'transit', 'carpool'];
  const sanitized = modes.filter((mode, index) => allowed.includes(mode) && modes.indexOf(mode) === index);
  return sanitized.length > 0 ? sanitized : DEFAULT_PROFILE.preferredModes;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
