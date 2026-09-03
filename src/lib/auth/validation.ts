// Normalisation du profil avant ecriture locale. Les memes bornes sont
// appliquees cote serveur par les schemas TypeBox : ici elles servent le
// retour immediat a l'utilisateur, la ou le serveur, lui, fait autorite.
import type { MobilityMode } from '../../types';
import { DEFAULT_PROFILE } from './defaults';

export function sanitizeDisplayName(value: string): string {
  const sanitized = value.trim().replace(/[<>]/g, '').slice(0, 80);
  return sanitized || DEFAULT_PROFILE.displayName;
}

export function sanitizeModes(modes: MobilityMode[]): MobilityMode[] {
  const allowed: MobilityMode[] = ['walk', 'bike', 'scooter', 'transit'];
  const sanitized = modes.filter((mode, index) => allowed.includes(mode) && modes.indexOf(mode) === index);
  return sanitized.length > 0 ? sanitized : DEFAULT_PROFILE.preferredModes;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }

  return Math.min(Math.max(value, min), max);
}
