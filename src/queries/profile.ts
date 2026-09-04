// Le profil de mobilite : lecture, et remplacement en entier.
import { useCallback } from 'react';
import type { AccountState, MobilityProfile } from '../contracts';
import { saveProfile } from '../lib/api';
import { useAccountMutation, useAccountPart, type AccountMutation } from './account';

export function useProfile(): MobilityProfile {
    return useAccountPart('profile');
}

/** Le profil arrive valide du formulaire (contrat partage) : il part tel quel. */
export function updateProfile(profile: MobilityProfile): Partial<AccountState> {
    return { profile };
}

export const profileSaveMutation = {
    key: 'profile-save',
    parts: ['profile'],
    mutationFn: saveProfile,
    optimistic: (_state, profile) => updateProfile(profile),
    reconcile: (_state, profile) => updateProfile(profile),
} satisfies AccountMutation<MobilityProfile, MobilityProfile>;

export function useUpdateProfile(): (profile: MobilityProfile) => void {
    const save = useAccountMutation(profileSaveMutation);
    return useCallback((profile: MobilityProfile) => save(profile), [save]);
}
