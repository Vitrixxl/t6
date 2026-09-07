// Un onglet choisit le parcours de la recherche, sans modifier le profil.
import { AVAILABLE_MODES } from '../../contracts/primitives';
import type { SearchKind } from '../../contracts/planning';
import type { AvailableMode, MobilityMode, MobilityProfile } from '../../types';

export const TRANSIT_TYPES = [
    { type: 3, label: 'Bus' },
    { type: 1, label: 'Métro' },
    { type: 0, label: 'Tramway' },
    { type: 7, label: 'Funiculaire' },
] as const;
export type TransitType = typeof TRANSIT_TYPES[number]['type'];
export const ALL_TRANSIT_TYPES: TransitType[] = TRANSIT_TYPES.map((option) => option.type);
export const AVAILABLE_MODE_LABELS: Record<AvailableMode, string> = {
    bike: 'Vélo’v', scooter: 'Dott', transit: 'Transport en commun',
};
export const SEARCH_TABS: { kind: SearchKind; label: string }[] = [
    { kind: 'walk', label: 'À pied' },
    { kind: 'bike', label: 'Vélo’v' },
    { kind: 'scooter', label: 'Dott' },
    { kind: 'transit', label: 'Transport en commun' },
    { kind: 'multimodal', label: 'Multitransport' },
];
export const SEARCH_MODES: Record<SearchKind, AvailableMode[]> = {
    walk: [], bike: ['bike'], scooter: ['scooter'], transit: ['transit'],
    multimodal: ['bike', 'scooter', 'transit'],
};
export interface SearchFilters {
    kind: SearchKind;
    transitTypes: TransitType[];
    /** Instant ISO ; absent, départ maintenant. */
    departureAt?: string;
}

/** Le profil amorce un onglet simple ; il n'autorise pas implicitement un nouvel engin. */
export function filtersFromProfile(profile: Pick<MobilityProfile, 'availableModes'>): SearchFilters {
    const modes = profile.availableModes;
    const kind = modes.includes('transit') ? 'transit' : modes.includes('bike') ? 'bike' : modes.includes('scooter') ? 'scooter' : 'walk';
    return { kind, transitTypes: ALL_TRANSIT_TYPES };
}

export function availableModesOf(modes: readonly MobilityMode[]): AvailableMode[] {
    return AVAILABLE_MODES.filter((mode) => modes.includes(mode));
}

/** Un favori combiné rouvre l'onglet des combinaisons ; ses mesures sont recalculées. */
export function filtersFromRoute(modes: readonly MobilityMode[]): SearchFilters {
    const combined = modes.includes('transit') && (modes.includes('bike') || modes.includes('scooter'));
    return combined ? { kind: 'multimodal', transitTypes: ALL_TRANSIT_TYPES } : filtersFromProfile({ availableModes: availableModesOf(modes) });
}
