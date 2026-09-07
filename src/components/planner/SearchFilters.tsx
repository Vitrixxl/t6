import { Tabs } from 'radix-ui';
import { Bike, Footprints, Layers, SlidersHorizontal, TrainFront, Zap } from 'lucide-react';
import { searchKind } from '../../contracts/planning';
import { ALL_TRANSIT_TYPES, SEARCH_TABS, TRANSIT_TYPES } from '../../lib/planner/search-filters';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useSearchFilters } from './useSearchFilters';
import { SearchDeparture } from './SearchDeparture';

const TAB_ICONS = { walk: Footprints, bike: Bike, scooter: Zap, transit: TrainFront, multimodal: Layers };

function TransitFilters() {
    const { filters, setFilters } = useSearchFilters();
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="min-h-11 text-xs">
                    <SlidersHorizontal className="size-4" aria-hidden="true" />
                    Types de transport ({filters.transitTypes.length}/4)
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] p-3">
                <fieldset className="grid gap-1">
                    <legend className="mb-2 text-sm font-semibold">Types de transport en commun</legend>
                    {TRANSIT_TYPES.map((option) => (
                        <label key={option.type} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted">
                            <input type="checkbox" className="size-4 accent-primary" checked={filters.transitTypes.includes(option.type)} onChange={() => setFilters({
                                ...filters,
                                transitTypes: ALL_TRANSIT_TYPES.filter(type => type === option.type ? !filters.transitTypes.includes(type) : filters.transitTypes.includes(type)),
                            })} />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
            </PopoverContent>
        </Popover>
    );
}

export function SearchFilters() {
    const { filters, setFilters } = useSearchFilters();
    return (
        <Tabs.Root value={filters.kind} onValueChange={value => {
            const parsed = searchKind.safeParse(value);
            if (parsed.success) setFilters({ ...filters, kind: parsed.data });
        }} className="min-w-0 shrink-0" data-tour="search-filters">
            <Tabs.List aria-label="Moyen de transport pour cette recherche" className="grid auto-cols-[minmax(5.25rem,1fr)] grid-flow-col gap-1 overflow-x-auto rounded-2xl bg-muted p-1">
                {SEARCH_TABS.map(tab => {
                    const Icon = TAB_ICONS[tab.kind];
                    return (
                        <Tabs.Trigger key={tab.kind} value={tab.kind} className="flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                            <Icon className="size-5 shrink-0" aria-hidden="true" />
                            <span className="flex min-h-8 items-center justify-center text-center leading-tight">{tab.label}</span>
                        </Tabs.Trigger>
                    );
                })}
            </Tabs.List>
            {SEARCH_TABS.map(tab => (
                <Tabs.Content key={tab.kind} value={tab.kind} className="space-y-2 data-[state=active]:mt-2">
                    <div className="flex flex-wrap gap-2">
                        <SearchDeparture />
                        {tab.kind === 'transit' || tab.kind === 'multimodal' ? <TransitFilters /> : null}
                    </div>
                    {tab.kind === 'multimodal' ? <p className="text-xs text-muted-foreground">Vélo’v + transports et Dott + transports, selon les disponibilités. Les accès à pied sont inclus.</p> : null}
                </Tabs.Content>
            ))}
        </Tabs.Root>
    );
}
