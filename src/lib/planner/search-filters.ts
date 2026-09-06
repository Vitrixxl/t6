// Ce qu'une recherche autorise : les moyens dont l'utilisateur dispose pour ce
// trajet et, s'il prend le transport en commun, les types de lignes. La marche
// est toujours possible ; elle n'est pas un filtre.
import { AVAILABLE_MODES } from '../../contracts/primitives';
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
    bike: 'Vélo’v',
    scooter: 'Dott',
    transit: 'Transport en commun',
};

export interface SearchFilters {
    modes: AvailableMode[];
    transitTypes: TransitType[];
}

/** Une recherche part de ce que le profil déclare, tous les types de lignes autorisés. */
export function filtersFromProfile(profile: Pick<MobilityProfile, 'availableModes'>): SearchFilters {
    return { modes: [...profile.availableModes], transitTypes: ALL_TRANSIT_TYPES };
}

/** Les moyens d'un trajet enregistré, dans l'ordre des cases : la marche n'en fait pas partie. */
export function availableModesOf(modes: readonly MobilityMode[]): AvailableMode[] {
    return AVAILABLE_MODES.filter((mode) => modes.includes(mode));
}

/** Résumé du filtre pour son bouton : « Vélo’v, Transport en commun (Bus) » ou « À pied seulement ». */
export function describeFilters(filters: SearchFilters): string {
    const modes = availableModesOf(filters.modes).map((mode) => AVAILABLE_MODE_LABELS[mode]);
    if (modes.length === 0) {
        return 'À pied seulement';
    }
    const restricted = filters.modes.includes('transit') && filters.transitTypes.length < ALL_TRANSIT_TYPES.length;
    const types = TRANSIT_TYPES.filter((option) => filters.transitTypes.includes(option.type)).map((option) => option.label);
    return restricted ? `${modes.join(', ')} (${types.join(', ') || 'aucun type'})` : modes.join(', ');
}
