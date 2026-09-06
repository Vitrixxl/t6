// Les filtres d'une recherche partent du profil ; le popover peut y déroger
// pour le trajet en cours, sans rien écrire dans le profil.
import { useMemo } from 'react';
import { useAtom } from 'jotai';
import { useProfile } from '../../queries';
import { searchFiltersAtom } from '../../state';
import { filtersFromProfile, type SearchFilters } from '../../lib/planner';

export function useSearchFilters(): {
    filters: SearchFilters;
    /** `null` revient à ce que le profil déclare. */
    setFilters: (filters: SearchFilters | null) => void;
    fromProfile: boolean;
} {
    const profile = useProfile();
    const [override, setOverride] = useAtom(searchFiltersAtom);
    const filters = useMemo(() => override ?? filtersFromProfile(profile), [override, profile]);
    return { filters, setFilters: setOverride, fromProfile: override === null };
}
