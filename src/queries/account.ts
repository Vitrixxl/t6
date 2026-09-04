// Les parties de l'etat du compte dans le cache de requetes : une requete par
// partie, et une seule mutation pour les ecrire.
//
// Une action calcule, par une fonction pure sur des listes, les parties
// qu'elle remplace. Elles s'affichent tout de suite, puis partent chacune
// vers sa route. Les envois sont serialises (`scope`) : deux actions en
// rafale partent dans l'ordre, la seconde avec l'etat que la premiere a
// laisse. Un refus est signale (save-error.ts) et, des qu'aucun envoi n'est
// plus en cours, les parties marquees sont relues depuis le serveur :
// l'ecran revient a ce que le serveur tient, il ne garde pas une modification
// refusee.
import { mutationOptions, queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { DEFAULT_PROFILE, type AccountState } from '../contracts';
import { ACCOUNT_PARTS, accountPartsOf, fetchAccountPart, saveAccountParts, type AccountPart } from '../lib/api';
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

/** Une action : une fonction pure qui rend les parties qu'elle remplace. */
export type AccountUpdate = (state: AccountState) => Partial<AccountState>;

function copyAccountPart<P extends AccountPart>(to: Partial<AccountState>, from: Partial<AccountState>, part: P): void {
  to[part] = from[part];
}

/** Les parties dont la reference a change : les fonctions pures ne recreent que ce qu'elles modifient. */
export function accountChanges(state: AccountState, next: Partial<AccountState>): Partial<AccountState> {
  const changes: Partial<AccountState> = {};
  for (const part of ACCOUNT_PARTS) {
    if (part in next && next[part] !== state[part]) {
      copyAccountPart(changes, next, part);
    }
  }
  return changes;
}

/**
 * Applique une action : calcule les parties qu'elle remplace, les affiche, et
 * rend ce qu'il reste a envoyer (null si l'action n'a rien change).
 *
 * L'affichage precede l'envoi, de facon synchrone : deux actions dans le meme
 * tour de boucle voient chacune l'etat que la precedente a laisse.
 */
export function stageAccountWrite(client: QueryClient, update: AccountUpdate): Partial<AccountState> | null {
  const state = readAccountState(client);
  const changes = accountChanges(state, update(state));
  const parts = accountPartsOf(changes);
  if (parts.length === 0) {
    return null;
  }
  for (const part of parts) {
    // Une lecture en vol rendrait un etat anterieur a l'action : annulee.
    void client.cancelQueries({ queryKey: queryKeys.accountPart(part) });
    applyAccountPart(client, changes, part);
  }
  return changes;
}

function othersInFlight(client: QueryClient): boolean {
  // La mutation en cours compte pour un : ses rappels precedent son etat final.
  return client.isMutating({ mutationKey: mutationKeys.accountWrite }) > 1;
}

export function accountWriteOptions(client: QueryClient) {
  return mutationOptions({
    mutationKey: mutationKeys.accountWrite,
    // Un envoi a la fois, dans l'ordre des actions.
    scope: { id: 'account' },
    mutationFn: (changes: Partial<AccountState>) => saveAccountParts(changes),
    onSuccess: (saved) => {
      // Le serveur rend chaque partie telle qu'il la tient. Elle ne remplace
      // le cache que si aucun envoi ne suit : sinon l'ecran reculerait le
      // temps que le suivant reponde.
      if (othersInFlight(client)) {
        return;
      }
      for (const part of accountPartsOf(saved)) {
        applyAccountPart(client, saved, part);
      }
    },
    onError: () => {
      // Marquees a relire, sans relecture tant qu'un envoi suit : c'est le
      // dernier de la rafale qui la declenche (onSettled).
      void client.invalidateQueries({ queryKey: queryKeys.account, refetchType: 'none' });
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

/** Rend la fonction qui applique une action au compte : affichage immediat, puis envoi. */
export function useAccountWrite(): (update: AccountUpdate) => void {
  const client = useQueryClient();
  const { mutate } = useMutation(accountWriteOptions(client));
  return useCallback(
    (update: AccountUpdate) => {
      const changes = stageAccountWrite(client, update);
      if (changes) {
        mutate(changes);
      }
    },
    [client, mutate],
  );
}
