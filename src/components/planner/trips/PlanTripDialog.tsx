// Formulaire de planification : trajet date ponctuel ou routine recurrente.
import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { CalendarClock, CalendarPlus, Repeat } from 'lucide-react';
import { useAtom } from 'jotai';
import { Button } from '../../ui/button';
import { Calendar } from '../../ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { WEEKDAY_LABELS } from '../../../lib/trips';
import { formatCarbonComparison } from '../../../lib/carbon-comparison';
import { planSourceAtom } from '../../../state';
import { OriginDestination } from './atoms';
import { FULL_DAY_FORMAT, toTimeInputValue } from './format';
import { PLAN_FORM_DEFAULTS, planForm, type PlanFormValues } from './planForm';
import { usePlanSubmission } from './usePlanSubmission';

function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function PlanTripDialog() {
    // Le formulaire s'ouvre des qu'un trajet est mis en planification, et se
    // ferme en rendant ce trajet a null : l'orchestrateur n'a rien a tenir.
    const [source, setSource] = useAtom(planSourceAtom);
    const submitPlan = usePlanSubmission();
    const onOpenChange = (open: boolean) => {
        if (!open) {
            setSource(null);
        }
    };
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const form = useForm<PlanFormValues>({ resolver: zodResolver(planForm), defaultValues: PLAN_FORM_DEFAULTS });
    const { errors } = form.formState;
    const kind = form.watch('kind');
    const date = form.watch('date');
    const daysOfWeek = form.watch('daysOfWeek');
    const roundTrip = form.watch('roundTrip');

    useEffect(() => {
        if (!source) {
            return;
        }
        const next = new Date(Date.now() + 45 * 60_000);
        next.setMinutes(next.getMinutes() >= 30 ? 60 : 30, 0, 0);
        form.reset({ ...PLAN_FORM_DEFAULTS, label: source.label, date: next, time: toTimeInputValue(next) });
        setDatePickerOpen(false);
    }, [form, source]);

    if (!source) {
        return null;
    }

    const toggleDay = (day: number) => {
        const current = daysOfWeek.includes(day)
            ? daysOfWeek.length === 1
                ? daysOfWeek
                : daysOfWeek.filter((item) => item !== day)
            : [...daysOfWeek, day];
        form.setValue('daysOfWeek', current, { shouldValidate: form.formState.isSubmitted });
    };

    // Sans date, le calendrier s'ouvre a la place d'un simple message.
    const submit = form.handleSubmit(submitPlan, (fieldErrors) => {
        if (fieldErrors.date) {
            setDatePickerOpen(true);
        }
    });

    return (
        <Dialog open onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <form noValidate onSubmit={submit}>
                    <DialogHeader>
                        <DialogTitle className="font-display">Planifier ce trajet</DialogTitle>
                        <DialogDescription>Une date precise, ou une routine dont chaque passage compte tout seul.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-3 px-5">
                        <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
                            <h3 className="truncate text-sm font-semibold">{source.label}</h3>
                            <OriginDestination origin={source.origin.label} destination={source.destination.label} />
                            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                                {source.durationMinutes} min · {source.distanceKm.toFixed(1)} km · {formatCarbonComparison(source.carbonSavedGrams)}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Type de planification">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={kind === 'once'}
                                className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition ${kind === 'once' ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                onClick={() => form.setValue('kind', 'once')}
                            >
                                <CalendarClock className="size-3.5" aria-hidden="true" />
                                Une fois
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={kind === 'recurring'}
                                className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition ${kind === 'recurring' ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                onClick={() => form.setValue('kind', 'recurring')}
                            >
                                <Repeat className="size-3.5" aria-hidden="true" />
                                Recurrent
                            </button>
                        </div>

                        <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-label">
                            Nom du trajet
                            <Input id="plan-label" className="h-9 text-sm" {...form.register('label')} />
                            <FieldError message={errors.label?.message} />
                        </label>

                        {kind === 'once' ? (
                            <div className="grid grid-cols-[1.4fr_1fr] gap-2">
                                <div className="grid gap-1.5 text-xs font-semibold">
                                    Date
                                    <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                        <PopoverTrigger asChild>
                                            <Button type="button" variant="outline" className="h-9 justify-start px-3 text-sm font-medium capitalize">
                                                <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                                                {date ? FULL_DAY_FORMAT.format(date) : 'Choisir une date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="start" className="w-auto">
                                            <Calendar
                                                mode="single"
                                                selected={date ?? undefined}
                                                defaultMonth={date ?? undefined}
                                                disabled={{ before: new Date() }}
                                                onSelect={(selected) => {
                                                    if (selected) {
                                                        form.setValue('date', selected, { shouldValidate: true });
                                                        setDatePickerOpen(false);
                                                    }
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FieldError message={errors.date?.message} />
                                </div>
                                <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-time">
                                    Heure
                                    <Input id="plan-time" type="time" className="h-9 text-sm" {...form.register('time')} />
                                    <FieldError message={errors.time?.message} />
                                </label>
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-1.5">
                                    <span className="text-xs font-semibold">Jours de la semaine</span>
                                    <div className="flex gap-1" role="group" aria-label="Jours actifs">
                                        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                                            <button
                                                key={day}
                                                type="button"
                                                aria-pressed={daysOfWeek.includes(day)}
                                                className={`h-8 flex-1 rounded-md text-[11px] font-bold transition ${daysOfWeek.includes(day)
                                                    ? 'bg-primary text-primary-foreground shadow-soft'
                                                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                                                    }`}
                                                onClick={() => toggleDay(day)}
                                            >
                                                {WEEKDAY_LABELS[day]}
                                            </button>
                                        ))}
                                    </div>
                                    <FieldError message={errors.daysOfWeek?.message} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-departure">
                                        Heure de depart
                                        <Input id="plan-departure" type="time" className="h-9 text-sm" {...form.register('departureTime')} />
                                        <FieldError message={errors.departureTime?.message} />
                                    </label>
                                    <label className={`grid gap-1.5 text-xs font-semibold ${roundTrip ? '' : 'opacity-45'}`} htmlFor="plan-return">
                                        Heure du retour
                                        <Input id="plan-return" type="time" className="h-9 text-sm" disabled={!roundTrip} {...form.register('returnTime')} />
                                        <FieldError message={errors.returnTime?.message} />
                                    </label>
                                </div>
                                <label className="flex items-center gap-2 text-sm font-medium">
                                    <input type="checkbox" className="size-4 accent-primary" {...form.register('roundTrip')} />
                                    Aller-retour (le retour est planifie automatiquement)
                                </label>
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Annuler
                        </Button>
                        <Button type="submit">
                            <CalendarPlus className="size-4" aria-hidden="true" />
                            {kind === 'once' ? 'Planifier' : 'Creer la routine'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
