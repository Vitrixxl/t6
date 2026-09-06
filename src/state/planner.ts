// État d'écran du planificateur : la recherche en cours, le trajet en cours de
// planification et le hub. Rien ici ne vient du serveur ; l'état du compte vit dans src/queries/.
import { atom } from 'jotai';
import type { SearchFilters } from '../lib/planner/search-filters';
import type { TripSource } from '../lib/trips';

/** Filtres de la recherche en cours ; `null` tant que l'utilisateur n'a pas dérogé à son profil. */
export const searchFiltersAtom = atom<SearchFilters | null>(null);

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
