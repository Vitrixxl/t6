// Le profil de mobilite : lecture, et remplacement en entier.
import { useCallback } from 'react';
import type { AccountState, MobilityProfile } from '../contracts';
import { useAccountPart, useAccountWrite } from './account';

export function useProfile(): MobilityProfile {
  return useAccountPart('profile');
}

/** Le profil arrive valide du formulaire (contrat partage) : il part tel quel. */
export function updateProfile(profile: MobilityProfile): Partial<AccountState> {
  return { profile };
}

export function useUpdateProfile(): (profile: MobilityProfile) => void {
  const write = useAccountWrite();
  return useCallback((profile: MobilityProfile) => write(() => updateProfile(profile)), [write]);
}
