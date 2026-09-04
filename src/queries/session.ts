// La session : reprise au demarrage, ouverture a la connexion, fermeture a la
// deconnexion ou a l'effacement du compte.
//
// La session est la seule requete qui ne se relit jamais d'elle-meme : la
// connexion et la deconnexion l'ecrivent directement dans le cache, et ce
// qu'elle rend a l'ouverture amorce chaque ressource du compte.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { Session } from '../contracts';
import { deleteAccount, loginUser, logoutUser, registerUser, restoreSession } from '../lib/api/auth';
import { mutationKeys, queryKeys } from './keys';

export const sessionQuery = queryOptions({
    queryKey: queryKeys.session,
    queryFn: () => restoreSession(),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
});

export function readSession(client: QueryClient): Session | null {
    return client.getQueryData(sessionQuery.queryKey) ?? null;
}

/** Ouvre une session : le compte et son etat, tels que le serveur les rend. */
export function openSession(client: QueryClient, session: Session): void {
    client.setQueryData(sessionQuery.queryKey, session);
}

export function closeSession(client: QueryClient): void {
    // Purger d'abord les ressources puis fermer la session. Les observateurs
    // des ecrans du compte peuvent encore se rendre entre deux notifications :
    // ils doivent alors voir l'ancienne session, jamais un compte deja absent.
    client.getMutationCache().clear();
    client.removeQueries({ queryKey: queryKeys.account });
    client.setQueryData(sessionQuery.queryKey, null);
}

export function logout(client: QueryClient): Promise<void> {
    const revocation = logoutUser();
    closeSession(client);
    return revocation;
}

/** Droit a l'effacement : le serveur supprime en cascade, puis la session se ferme. */
export function deleteAccountOptions(client: QueryClient) {
    return mutationOptions({
        mutationKey: mutationKeys.deleteAccount,
        mutationFn: () => deleteAccount(),
        onSuccess: () => closeSession(client),
        // Un refus reste lisible (useSaveError) tant qu'un succes ne l'a pas remplace.
        gcTime: Infinity,
    });
}

export function useSession() {
    return useQuery(sessionQuery);
}

export function useLogin() {
    const client = useQueryClient();
    return useMutation({ mutationFn: loginUser, onSuccess: (session) => openSession(client, session) });
}

export function useRegister() {
    const client = useQueryClient();
    return useMutation({ mutationFn: registerUser, onSuccess: (session) => openSession(client, session) });
}

export function useLogout(): () => void {
    const client = useQueryClient();
    return useCallback(() => void logout(client), [client]);
}

export function useDeleteAccount() {
    const client = useQueryClient();
    return useMutation(deleteAccountOptions(client));
}
