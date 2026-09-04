// Les parties de l'etat du compte dans le cache de requetes : une requete par
// partie et une commande typee par ressource pour les modifier.
//
// Une commande applique sa projection optimiste au cache, puis n'envoie que
// l'element vise. Les envois sont serialises (`scope`) pour conserver l'ordre
// des actions. Un refus invalide seulement les vues concernees ; elles sont
// relues des que la rafale est terminee.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { DEFAULT_PROFILE, type AccountState } from '../contracts';
import { ACCOUNT_PARTS, fetchAccountPart, type AccountPart } from '../lib/api';
import { mutationKeys, queryKeys } from './keys';
import { readSession } from './session';

const EMPTY_STATE: AccountState = {
  profile: DEFAULT_PROFILE,
  tripRecords: [],
  plannedTrips: [],
  recurringTrips: [],
  savedRoutes: [],
};

/** Une partie telle que le cache la tient, sinon telle que la session l'a rendue. */
export function readAccountPart<P extends AccountPart>(client: QueryClient, part: P): AccountState[P] {
  return client.getQueryData<AccountState[P]>(queryKeys.accountPart(part)) ?? readSession(client)?.state[part] ?? EMPTY_STATE[part];
}

export function readAccountState(client: QueryClient): AccountState {
  return {
    profile: readAccountPart(client, 'profile'),
    tripRecords: readAccountPart(client, 'tripRecords'),
    plannedTrips: readAccountPart(client, 'plannedTrips'),
    recurringTrips: readAccountPart(client, 'recurringTrips'),
    savedRoutes: readAccountPart(client, 'savedRoutes'),
  };
}

function applyAccountPart<P extends AccountPart>(client: QueryClient, changes: Partial<AccountState>, part: P): void {
  const value = changes[part];
  if (value !== undefined) {
    client.setQueryData<AccountState[P]>(queryKeys.accountPart(part), value);
  }
}

export function accountPartQuery<P extends AccountPart>(client: QueryClient, part: P) {
  return queryOptions({
    queryKey: queryKeys.accountPart(part),
    queryFn: () => fetchAccountPart(part),
    // La session rend l'etat complet a la connexion : la premiere lecture ne
    // coute aucune requete.
    initialData: () => readSession(client)?.state[part] ?? EMPTY_STATE[part],
    initialDataUpdatedAt: () => client.getQueryState(queryKeys.session)?.dataUpdatedAt,
    // Le serveur reste la reference : une partie se relit quand l'onglet
    // revient au premier plan, passe ce delai.
    staleTime: 60_000,
  });
}

export function useAccountPart<P extends AccountPart>(part: P): AccountState[P] {
  const client = useQueryClient();
  const { data } = useQuery(accountPartQuery(client, part));
  // `initialData` est toujours fourni, la donnee n'est donc jamais absente ;
  // le type generique de la partie empeche React Query de le deduire.
  return data ?? EMPTY_STATE[part];
}

// --- Ecriture ---------------------------------------------------------------

export interface AccountMutation<Variables, Result> {
  /** Suffixe lisible dans les outils React Query. */
  key: string;
  /** Vues a invalider si le serveur refuse la commande. */
  parts: readonly AccountPart[];
  mutationFn: (variables: Variables) => Promise<Result>;
  optimistic: (state: AccountState, variables: Variables) => Partial<AccountState>;
  reconcile: (state: AccountState, result: Result, variables: Variables) => Partial<AccountState>;
}

/** Applique une projection au cache, sans transformer cette vue en corps HTTP. */
export function stageAccountChanges(client: QueryClient, changes: Partial<AccountState>): void {
  for (const part of ACCOUNT_PARTS) {
    if (changes[part] === undefined) {
      continue;
    }
    // Une lecture en vol rendrait un etat anterieur a l'action : annulee.
    void client.cancelQueries({ queryKey: queryKeys.accountPart(part) });
    applyAccountPart(client, changes, part);
  }
}

function othersInFlight(client: QueryClient): boolean {
  // La mutation en cours compte pour un : ses rappels precedent son etat final.
  return client.isMutating({ mutationKey: mutationKeys.accountWrite }) > 1;
}

export function accountMutationOptions<Variables, Result>(client: QueryClient, command: AccountMutation<Variables, Result>) {
  return mutationOptions({
    mutationKey: [...mutationKeys.accountWrite, command.key],
    // Un envoi a la fois, dans l'ordre des actions.
    scope: { id: 'account' },
    mutationFn: command.mutationFn,
    onMutate: (variables) => {
      stageAccountChanges(client, command.optimistic(readAccountState(client), variables));
    },
    onSuccess: (result, variables) => {
      // Le serveur rend la ressource telle qu'il la tient. Elle ne remplace le
      // cache que si aucun envoi ne suit : une projection optimiste plus
      // recente ne doit pas disparaitre pendant la rafale.
      if (othersInFlight(client)) {
        return;
      }
      stageAccountChanges(client, command.reconcile(readAccountState(client), result, variables));
    },
    onError: () => {
      for (const part of command.parts) {
        void client.invalidateQueries({ queryKey: queryKeys.accountPart(part), refetchType: 'none' });
      }
    },
    onSettled: async () => {
      if (othersInFlight(client)) {
        return;
      }
      await client.refetchQueries({ queryKey: queryKeys.account, type: 'active', predicate: (query) => query.state.isInvalidated });
    },
    // Un refus reste lisible (useSaveError) tant qu'un succes ne l'a pas remplace.
    gcTime: Infinity,
  });
}

/** Rend une commande : projection optimiste immediate, puis appel Eden type. */
export function useAccountMutation<Variables, Result>(command: AccountMutation<Variables, Result>): (variables: Variables) => void {
  const client = useQueryClient();
  const { mutate } = useMutation(accountMutationOptions(client, command));
  return useCallback((variables: Variables) => mutate(variables), [mutate]);
}
