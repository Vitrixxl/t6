import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarClock } from 'lucide-react';
import type { z } from 'zod';
import { departureSelection } from '../../contracts/planning';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useSearchFilters } from './useSearchFilters';

const DEPARTURE_FORMAT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function localDateTime(iso?: string): string {
    const date = iso ? new Date(iso) : new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

export function SearchDeparture() {
    const inputId = useId();
    const { filters, setFilters } = useSearchFilters();
    const [open, setOpen] = useState(false);
    const form = useForm<z.input<typeof departureSelection>, unknown, z.output<typeof departureSelection>>({
        resolver: zodResolver(departureSelection),
        defaultValues: { localDeparture: localDateTime(filters.departureAt) },
    });
    const changeOpen = (value: boolean) => {
        if (value) form.reset({ localDeparture: localDateTime(filters.departureAt) });
        setOpen(value);
    };
    return (
        <Popover open={open} onOpenChange={changeOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="min-h-11 max-w-full text-xs">
                    <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">Départ : {filters.departureAt ? DEPARTURE_FORMAT.format(new Date(filters.departureAt)) : 'Maintenant'}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(340px,calc(100vw-2rem))] p-3">
                <form className="grid gap-3" onSubmit={form.handleSubmit(values => {
                    setFilters({ ...filters, departureAt: values.localDeparture });
                    setOpen(false);
                })}>
                    <label htmlFor={inputId} className="grid gap-2 text-sm font-semibold">
                        Date et heure de départ
                        <Input id={inputId} type="datetime-local" className="min-h-11 min-w-0" {...form.register('localDeparture')} aria-invalid={Boolean(form.formState.errors.localDeparture)} />
                    </label>
                    {form.formState.errors.localDeparture ? <p role="alert" className="text-xs text-destructive">{form.formState.errors.localDeparture.message}</p> : null}
                    {filters.kind === 'bike' || filters.kind === 'scooter' || filters.kind === 'multimodal' ? <p className="text-xs text-muted-foreground">Les disponibilités Vélo’v et Dott sont celles de maintenant, pas une prévision.</p> : null}
                    <div className="flex justify-between gap-2">
                        <Button type="button" variant="outline" onClick={() => {
                            setFilters({ ...filters, departureAt: undefined });
                            setOpen(false);
                        }}>Maintenant</Button>
                        <Button type="submit">Appliquer</Button>
                    </div>
                </form>
            </PopoverContent>
        </Popover>
    );
}
