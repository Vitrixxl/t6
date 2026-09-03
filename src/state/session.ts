// Session et etat du compte : les atomes que toute l'interface lit.
//
// Le serveur est la seule source de verite. L'etat est recu a l'ouverture de
// session, tenu ici en memoire, modifie par des fonctions pures, et chaque
// action renvoie les parties qu'elle a touchees : un trajet planifie part
// seul, sans le profil ni l'historique. Les envois sont serialises et
// coalesces : un envoi emporte toutes les parties modifiees depuis le
// precedent, dans leur etat le plus recent, donc une rafale d'actions ne
// produit jamais un etat ancien qui ecraserait un plus recent. Une partie
// refusee reste a envoyer et repart avec la prochaine action ; l'erreur est
// signalee, pas masquee.
import { atom } from 'jotai';
import type { SessionUser } from '../types';
import { saveAccountParts, type AccountPart, type AccountState, type Session } from '../lib/api/account';
import { deleteAccount as deleteAccountRequest, logoutUser } from '../lib/auth';
import { DEFAULT_PROFILE } from '../lib/auth/defaults';
import { summarizeCarbon } from '../lib/carbon';
import { summarizeTripActivity, upcomingTrips } from '../lib/trips';

const EMPTY_STATE: AccountState = {
  profile: DEFAULT_PROFILE,
  tripRecords: [],
  plannedTrips: [],
  recurringTrips: [],
  savedRoutes: [],
};

export const sessionAtom = atom<Session | null>(null);
export const accountStateAtom = atom<AccountState>(EMPTY_STATE);
/** Dernier envoi refuse par le serveur, ou chaine vide. */
export const saveErrorAtom = atom('');

// File d'envoi et parties a envoyer, hors des atomes parce qu'elles ne sont
// pas un etat a afficher. La file est exposee pour que les tests puissent
// attendre la fin.
let saveQueue: Promise<void> = Promise.resolve();
let pendingParts = new Set<AccountPart>();

export function pendingSaves(): Promise<void> {
  return saveQueue;
}

/** Les parties dont la reference a change : les fonctions pures ne recreent que ce qu'elles modifient. */
export function changedParts(before: AccountState, after: AccountState): AccountPart[] {
  return (Object.keys(after) as AccountPart[]).filter((part) => before[part] !== after[part]);
}

/** Modifie l'etat en memoire, puis envoie au serveur les parties modifiees. */
export const updateAccountAtom = atom(null, (get, set, updater: (state: AccountState) => AccountState) => {
  const before = get(accountStateAtom);
  const after = updater(before);
  set(accountStateAtom, after);
  for (const part of changedParts(before, after)) {
    pendingParts.add(part);
  }

  saveQueue = saveQueue.then(async () => {
    // Le lot est preleve avant l'envoi : une action survenue pendant l'envoi
    // remplit un nouveau lot, que son propre tour enverra.
    const parts = pendingParts;
    pendingParts = new Set();
    if (parts.size === 0) {
      return;
    }
    try {
      await saveAccountParts(get(accountStateAtom), parts);
      set(saveErrorAtom, '');
    } catch (error) {
      for (const part of parts) {
        pendingParts.add(part);
      }
      set(saveErrorAtom, error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  });
});

/** Ouvre une session : le compte et son etat, tels que le serveur les rend. */
export const openSessionAtom = atom(null, (_get, set, session: Session) => {
  set(sessionAtom, session);
  set(accountStateAtom, session.state);
  set(saveErrorAtom, '');
  pendingParts = new Set();
});

export const closeSessionAtom = atom(null, (_get, set) => {
  set(sessionAtom, null);
  set(accountStateAtom, EMPTY_STATE);
  set(saveErrorAtom, '');
  // Un envoi refuse ne doit pas survivre a la session qui l'a produit.
  pendingParts = new Set();
});

export const logoutAtom = atom(null, (_get, set) => {
  logoutUser();
  set(closeSessionAtom);
});

/** Droit a l'effacement : le serveur supprime en cascade, puis la session se ferme. */
export const deleteAccountAtom = atom(null, async (_get, set) => {
  try {
    await deleteAccountRequest();
    set(closeSessionAtom);
  } catch (error) {
    set(saveErrorAtom, error instanceof Error ? error.message : 'Suppression impossible.');
  }
});

// --- Lectures derivees ------------------------------------------------------

export const profileAtom = atom((get) => get(accountStateAtom).profile);
export const tripRecordsAtom = atom((get) => get(accountStateAtom).tripRecords);
export const plannedTripsAtom = atom((get) => get(accountStateAtom).plannedTrips);
export const recurringTripsAtom = atom((get) => get(accountStateAtom).recurringTrips);
export const savedRoutesAtom = atom((get) => get(accountStateAtom).savedRoutes);

/** Compte avec le profil courant : ce que les ecrans affichent. Exige une session ouverte. */
export const userAtom = atom<SessionUser>((get) => {
  const session = get(sessionAtom);
  if (!session) {
    throw new Error('Aucune session ouverte.');
  }
  const profile = get(profileAtom);
  return { ...session.user, displayName: profile.displayName, profile };
});

export const upcomingAtom = atom((get) => upcomingTrips(get(plannedTripsAtom)));
export const activitySummaryAtom = atom((get) => summarizeTripActivity(get(plannedTripsAtom), get(recurringTripsAtom)));
// Les routines n'ecrivent rien dans l'historique : leurs passages echus de la
// semaine sont ajoutes au moment de compter, comme dans les objectifs.
export const carbonSummaryAtom = atom((get) =>
  summarizeCarbon(get(tripRecordsAtom), get(recurringTripsAtom), get(profileAtom).carbonGoalGramsPerWeek),
);
