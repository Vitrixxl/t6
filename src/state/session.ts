// Session et etat du compte : les atomes que toute l'interface lit.
//
// Le serveur est la seule source de verite. L'etat est recu a l'ouverture de
// session, tenu ici en memoire, modifie par des fonctions pures et renvoye en
// entier apres chaque action. Les envois sont serialises : chacun part avec
// l'etat le plus recent au moment ou il part, donc une rafale d'actions ne
// produit jamais un etat ancien qui ecraserait un plus recent. Une ecriture
// refusee est signalee, pas masquee.
import { atom } from 'jotai';
import type { SessionUser } from '../types';
import { saveAccountState, type AccountState, type Session } from '../lib/api/account';
import { deleteAccount as deleteAccountRequest, logoutUser } from '../lib/auth';
import { DEFAULT_PROFILE } from '../lib/auth/defaults';
import { summarizeCarbon } from '../lib/carbon';
import { materializeOccurrences, summarizeTripActivity, upcomingTrips } from '../lib/trips';

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

// File d'envoi : une promesse chainee, hors des atomes parce qu'elle n'est pas
// un etat a afficher. Exposee pour que les tests puissent attendre la fin.
let saveQueue: Promise<void> = Promise.resolve();

export function pendingSaves(): Promise<void> {
  return saveQueue;
}

/** Modifie l'etat en memoire, puis l'envoie en entier au serveur. */
export const updateAccountAtom = atom(null, (get, set, updater: (state: AccountState) => AccountState) => {
  set(accountStateAtom, updater(get(accountStateAtom)));
  saveQueue = saveQueue
    .then(() => saveAccountState(get(accountStateAtom)))
    .then(
      () => set(saveErrorAtom, ''),
      (error: unknown) => set(saveErrorAtom, error instanceof Error ? error.message : 'Enregistrement impossible.'),
    );
});

/** Ouvre une session : le compte, son etat, et les occurrences des routines a jour. */
export const openSessionAtom = atom(null, (_get, set, session: Session) => {
  set(sessionAtom, session);
  set(accountStateAtom, session.state);
  set(saveErrorAtom, '');
  // L'utilisateur retrouve sa semaine planifiee sans action de sa part ; si
  // des occurrences manquent, l'etat complete part au serveur.
  const planned = materializeOccurrences(session.state.recurringTrips, session.state.plannedTrips, session.user.id);
  if (planned !== session.state.plannedTrips) {
    set(updateAccountAtom, (state) => ({ ...state, plannedTrips: planned }));
  }
});

export const closeSessionAtom = atom(null, (_get, set) => {
  set(sessionAtom, null);
  set(accountStateAtom, EMPTY_STATE);
  set(saveErrorAtom, '');
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
export const carbonSummaryAtom = atom((get) => summarizeCarbon(get(tripRecordsAtom), get(profileAtom).carbonGoalGramsPerWeek));
