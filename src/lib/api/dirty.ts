// Marque « etat local en avance sur le serveur ».
//
// L'utilisateur en mobilite perd le reseau au milieu d'un trajet : on ne peut
// ni bloquer l'interface le temps d'un aller-retour serveur, ni perdre son
// action. Chaque ecriture est donc appliquee au cache local, puis signalee ici.
// La synchronisation envoie l'etat complet des que le reseau le permet.
//
// La marque porte un jeton tire a chaque ecriture : la synchronisation ne
// l'efface que si le jeton n'a pas change pendant la requete. Une ecriture
// faite entre le depart de la requete et sa reponse reste donc a envoyer.
const DIRTY_KEY = 'ufm.dirty';

/** Emis a chaque ecriture locale : la synchronisation s'y abonne pour envoyer sans attendre. */
export const DIRTY_EVENT = 'ufm:dirty';

export interface DirtyMark {
  userId: string;
  token: string;
}

export function readDirty(): DirtyMark | null {
  const raw = localStorage.getItem(DIRTY_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as DirtyMark;
  } catch {
    localStorage.removeItem(DIRTY_KEY);
    return null;
  }
}

export function markDirty(userId: string): void {
  localStorage.setItem(DIRTY_KEY, JSON.stringify({ userId, token: crypto.randomUUID() } satisfies DirtyMark));
  // Hors navigateur (tests), personne n'ecoute : la marque suffit.
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(DIRTY_EVENT));
  }
}

export function hasPending(userId: string): boolean {
  return readDirty()?.userId === userId;
}

/** Efface la marque, sauf si une ecriture l'a renouvelee entre-temps. */
export function clearDirty(mark: DirtyMark): void {
  const current = readDirty();
  if (current && current.userId === mark.userId && current.token === mark.token) {
    localStorage.removeItem(DIRTY_KEY);
  }
}

/** Un compte supprime n'a plus rien a envoyer. */
export function discardPending(userId: string): void {
  if (hasPending(userId)) {
    localStorage.removeItem(DIRTY_KEY);
  }
}
