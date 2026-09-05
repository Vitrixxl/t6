// Profil de mobilité : une ressource unique, lue et remplacée telle quelle.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { DEFAULT_PROFILE, type MobilityProfile } from '../contracts';
import { fetchProfile, saveProfile } from '../lib/api/profile';
import { mutationKeys, queryKeys } from './keys';
import { readSession } from './session';

export function profileQuery(client: QueryClient) {
    return queryOptions({
        queryKey: queryKeys.profile,
        queryFn: fetchProfile,
        initialData: () => readSession(client)?.state.profile ?? DEFAULT_PROFILE,
        initialDataUpdatedAt: () => client.getQueryState(queryKeys.session)?.dataUpdatedAt,
        staleTime: 60_000,
    });
}

export function saveProfileOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.profileSave,
        scope: { id: 'account' },
        mutationFn: saveProfile,
        onMutate: () => client.cancelQueries({ queryKey: queryKeys.profile }),
        onSuccess: (profile) => client.setQueryData(queryKeys.profile, profile),
        onError: () => client.invalidateQueries({ queryKey: queryKeys.profile }),
        gcTime: Infinity,
    });
}

export function useProfile(): MobilityProfile {
    const client = useQueryClient();
    return useQuery(profileQuery(client)).data;
}

export function useUpdateProfile(): (profile: MobilityProfile) => void {
    const client = useQueryClient();
    const save = useMutation(saveProfileOptions(client));
    return save.mutate;
}
