// Filtres de la recherche en cours : ce que l'utilisateur peut prendre pour ce
// trajet, et les types de lignes s'il prend le transport en commun.
import { SlidersHorizontal } from 'lucide-react';
import { AVAILABLE_MODES } from '../../contracts/primitives';
import { ALL_TRANSIT_TYPES, AVAILABLE_MODE_LABELS, TRANSIT_TYPES, describeFilters, type TransitType } from '../../lib/planner';
import type { AvailableMode } from '../../types';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useSearchFilters } from './useSearchFilters';

export function SearchFilters() {
    const { filters, setFilters, fromProfile } = useSearchFilters();
    const summary = describeFilters(filters);
    const toggleMode = (mode: AvailableMode) => setFilters({
        ...filters,
        modes: AVAILABLE_MODES.filter((item) => item === mode ? !filters.modes.includes(item) : filters.modes.includes(item)),
    });
    const toggleType = (type: TransitType) => setFilters({
        ...filters,
        transitTypes: ALL_TRANSIT_TYPES.filter((item) => item === type ? !filters.transitTypes.includes(item) : filters.transitTypes.includes(item)),
    });

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button type="button" className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-xs font-medium"
                    aria-label={`Moyens de transport : ${summary}`} data-tour="search-filters">
                    <span className="min-w-0 truncate">Moyens de transport · {summary}</span>
                    <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(340px,calc(100vw-2rem))] p-3">
                <fieldset className="grid gap-1">
                    <legend className="mb-2 text-sm font-semibold">Ce que tu peux prendre pour ce trajet</legend>
                    {AVAILABLE_MODES.map((mode) => (
                        <label key={mode} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted">
                            <input type="checkbox" className="size-4 accent-primary" checked={filters.modes.includes(mode)} onChange={() => toggleMode(mode)} />
                            {AVAILABLE_MODE_LABELS[mode]}
                        </label>
                    ))}
                </fieldset>
                {filters.modes.includes('transit') ? (
                    <fieldset className="mt-2 grid gap-1 border-t border-border pt-2">
                        <legend className="mb-2 text-sm font-semibold">Types de transport en commun</legend>
                        {TRANSIT_TYPES.map((option) => (
                            <label key={option.type} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted">
                                <input type="checkbox" className="size-4 accent-primary" checked={filters.transitTypes.includes(option.type)} onChange={() => toggleType(option.type)} />
                                {option.label}
                            </label>
                        ))}
                    </fieldset>
                ) : null}
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Le trajet proposé est le plus rapide avec ces moyens ; la marche reste toujours possible.
                    Ce choix vaut pour cette recherche, ton profil garde ce dont tu disposes habituellement.
                </p>
                {fromProfile ? null : (
                    <Button type="button" variant="outline" size="sm" className="mt-2 w-full justify-center" onClick={() => setFilters(null)}>
                        Revenir à mon profil
                    </Button>
                )}
            </PopoverContent>
        </Popover>
    );
}
