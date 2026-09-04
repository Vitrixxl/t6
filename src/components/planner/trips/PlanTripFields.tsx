// Champs du formulaire de planification. Le dialogue choisit le bloc a afficher ;
// chaque bloc ne gere que ses valeurs et ses erreurs.
import type { UseFormReturn } from 'react-hook-form';
import { CalendarClock, Repeat } from 'lucide-react';
import { Button } from '../../ui/button';
import { Calendar } from '../../ui/calendar';
import { Input } from '../../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { WEEKDAY_LABELS } from '../../../lib/trips';
import { FULL_DAY_FORMAT } from './format';
import type { PlanFormValues } from './planForm';

export function FieldError({ message }: { message?: string }) {
    return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

export function PlanningKindTabs({ kind, onChange }: { kind: PlanFormValues['kind']; onChange: (kind: PlanFormValues['kind']) => void }) {
    const tabClass = (active: boolean) => `flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition ${active ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
        }`;
    return (
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Type de planification">
            <button type="button" role="tab" aria-selected={kind === 'once'} className={tabClass(kind === 'once')} onClick={() => onChange('once')}>
                <CalendarClock className="size-3.5" aria-hidden="true" />
                Une fois
            </button>
            <button type="button" role="tab" aria-selected={kind === 'recurring'} className={tabClass(kind === 'recurring')} onClick={() => onChange('recurring')}>
                <Repeat className="size-3.5" aria-hidden="true" />
                Recurrent
            </button>
        </div>
    );
}

export function OnceScheduleFields({
    form,
    datePickerOpen,
    onDatePickerOpenChange,
}: {
    form: UseFormReturn<PlanFormValues>;
    datePickerOpen: boolean;
    onDatePickerOpenChange: (open: boolean) => void;
}) {
    const date = form.watch('date');
    const { errors } = form.formState;
    return (
        <div className="grid grid-cols-[1.4fr_1fr] gap-2">
            <div className="grid gap-1.5 text-xs font-semibold">
                Date
                <Popover open={datePickerOpen} onOpenChange={onDatePickerOpenChange}>
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
                                    onDatePickerOpenChange(false);
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
    );
}

function toggleDay(days: number[], day: number): number[] {
    if (!days.includes(day)) {
        return [...days, day];
    }
    return days.length === 1 ? days : days.filter((item) => item !== day);
}

export function RecurringScheduleFields({ form }: { form: UseFormReturn<PlanFormValues> }) {
    const days = form.watch('daysOfWeek');
    const roundTrip = form.watch('roundTrip');
    const { errors } = form.formState;
    const selectDay = (day: number) => {
        form.setValue('daysOfWeek', toggleDay(days, day), { shouldValidate: form.formState.isSubmitted });
    };
    return (
        <>
            <div className="grid gap-1.5">
                <span className="text-xs font-semibold">Jours de la semaine</span>
                <div className="flex gap-1" role="group" aria-label="Jours actifs">
                    {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                        <button
                            key={day}
                            type="button"
                            aria-pressed={days.includes(day)}
                            className={`h-8 flex-1 rounded-md text-[11px] font-bold transition ${days.includes(day)
                                ? 'bg-primary text-primary-foreground shadow-soft'
                                : 'bg-muted text-muted-foreground hover:bg-muted/70'
                                }`}
                            onClick={() => selectDay(day)}
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
    );
}
