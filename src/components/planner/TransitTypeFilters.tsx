import { useAtom } from 'jotai';
import { ChevronDown } from 'lucide-react';
import { transitTypesAtom } from '../../state';
import { TRANSIT_TYPES } from '../../lib/planner/transit-filter';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

export function TransitTypeFilters() {
    const [selected, setSelected] = useAtom(transitTypesAtom);
    const labels = TRANSIT_TYPES.filter(option => selected.includes(option.type)).map(option => option.label);
    const summary = selected.length === TRANSIT_TYPES.length ? 'Tous' : labels.join(', ') || 'Aucun';
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button type="button" className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 text-left text-xs font-medium"
                    aria-label={`Types de transport en commun : ${summary}`}>
                    <span className="min-w-0 truncate">Transports en commun · {summary}</span>
                    <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(320px,calc(100vw-2rem))] p-3">
                <fieldset className="grid gap-1">
                    <legend className="mb-2 text-sm font-semibold">Transports en commun autorisés</legend>
                    {TRANSIT_TYPES.map(option => (
                        <label key={option.type} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-2 text-sm hover:bg-muted">
                            <input type="checkbox" className="size-4 accent-primary" checked={selected.includes(option.type)}
                                onChange={() => setSelected(current => TRANSIT_TYPES
                                    .filter(item => item.type === option.type ? !current.includes(item.type) : current.includes(item.type))
                                    .map(item => item.type))} />
                            {option.label}
                        </label>
                    ))}
                </fieldset>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Le calcul utilise uniquement les types cochés, correspondances comprises. Choisir une option sans transport en commun remet tous les types à disposition.</p>
            </PopoverContent>
        </Popover>
    );
}
