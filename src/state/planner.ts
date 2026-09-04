// Etat d'ecran du planificateur : le trajet en cours de planification et le
// hub. Rien ici ne vient du serveur ; l'etat du compte vit dans src/queries/.
import { atom } from 'jotai';
import type { TripSource } from '../lib/trips';

export type TripsHubTab = 'upcoming' | 'recurring' | 'history' | 'saved';

/** Trajet en cours de planification, ou null si le formulaire est ferme. */
export const planSourceAtom = atom<TripSource | null>(null);

export const tripsHubAtom = atom<{ open: boolean; tab: TripsHubTab }>({ open: false, tab: 'upcoming' });

export const openHubAtom = atom(null, (_get, set, tab: TripsHubTab = 'upcoming') => {
    set(tripsHubAtom, { open: true, tab });
});

export const closeHubAtom = atom(null, (get, set) => {
    set(tripsHubAtom, { ...get(tripsHubAtom), open: false });
});
