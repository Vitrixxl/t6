// Formulaire de planification : trajet date ponctuel ou routine recurrente.
import { useEffect, useState } from 'react';
import { CalendarClock, CalendarPlus, Repeat } from 'lucide-react';
import { Button } from '../../ui/button';
import { Calendar } from '../../ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { useAtom, useSetAtom } from 'jotai';
import { WEEKDAY_LABELS } from '../../../lib/trips';
import { planSourceAtom, submitPlanAtom, type PlanSubmission } from '../../../state';
import { OriginDestination } from './atoms';
import { FULL_DAY_FORMAT, toTimeInputValue } from './format';

export type PlanTripSubmit = PlanSubmission;

export function PlanTripDialog() {
  // Le formulaire s'ouvre des qu'un trajet est mis en planification, et se
  // ferme en rendant ce trajet a null : l'orchestrateur n'a rien a tenir.
  const [source, setSource] = useAtom(planSourceAtom);
  const onSubmit = useSetAtom(submitPlanAtom);
  const onOpenChange = (open: boolean) => {
    if (!open) {
      setSource(null);
    }
  };
  const [kind, setKind] = useState<'once' | 'recurring'>('once');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [time, setTime] = useState('08:30');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [departureTime, setDepartureTime] = useState('08:30');
  const [roundTrip, setRoundTrip] = useState(true);
  const [returnTime, setReturnTime] = useState('18:00');

  useEffect(() => {
    if (!source) {
      return;
    }
    const next = new Date(Date.now() + 45 * 60_000);
    next.setMinutes(next.getMinutes() >= 30 ? 60 : 30, 0, 0);
    setKind('once');
    setLabel(source.label);
    setDate(next);
    setDatePickerOpen(false);
    setTime(toTimeInputValue(next));
  }, [source]);

  if (!source) {
    return null;
  }

  const toggleDay = (day: number) => {
    setDaysOfWeek((current) => {
      if (current.includes(day)) {
        return current.length === 1 ? current : current.filter((item) => item !== day);
      }
      return [...current, day];
    });
  };

  const submit = () => {
    const cleanLabel = label.trim() || source.label;
    if (kind === 'once') {
      if (!date) {
        setDatePickerOpen(true);
        return;
      }
      const [hours, minutes] = time.split(':').map(Number);
      onSubmit({
        kind,
        label: cleanLabel,
        scheduledFor: new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours ?? 8, minutes ?? 0),
      });
    } else {
      onSubmit({ kind, label: cleanLabel, daysOfWeek, departureTime, returnTime: roundTrip ? returnTime : null });
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Planifier ce trajet</DialogTitle>
          <DialogDescription>Une date precise, ou une routine dont chaque passage compte tout seul.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 px-5">
          <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
            <h3 className="truncate text-sm font-semibold">{source.label}</h3>
            <OriginDestination origin={source.origin.label} destination={source.destination.label} />
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              {source.durationMinutes} min · {source.distanceKm.toFixed(1)} km · -{source.carbonSavedGrams} g CO2
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Type de planification">
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'once'}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition ${
                kind === 'once' ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setKind('once')}
            >
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Une fois
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'recurring'}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition ${
                kind === 'recurring' ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setKind('recurring')}
            >
              <Repeat className="size-3.5" aria-hidden="true" />
              Recurrent
            </button>
          </div>

          <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-label">
            Nom du trajet
            <Input id="plan-label" value={label} onChange={(event) => setLabel(event.target.value)} className="h-9 text-sm" />
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
                      selected={date}
                      defaultMonth={date}
                      disabled={{ before: new Date() }}
                      onSelect={(selected) => {
                        if (selected) {
                          setDate(selected);
                          setDatePickerOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-time">
                Heure
                <Input id="plan-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-9 text-sm" />
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
                      className={`h-8 flex-1 rounded-md text-[11px] font-bold transition ${
                        daysOfWeek.includes(day)
                          ? 'bg-primary text-primary-foreground shadow-soft'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                      onClick={() => toggleDay(day)}
                    >
                      {WEEKDAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-departure">
                  Heure de depart
                  <Input
                    id="plan-departure"
                    type="time"
                    value={departureTime}
                    onChange={(event) => setDepartureTime(event.target.value)}
                    className="h-9 text-sm"
                  />
                </label>
                <label className={`grid gap-1.5 text-xs font-semibold ${roundTrip ? '' : 'opacity-45'}`} htmlFor="plan-return">
                  Heure du retour
                  <Input
                    id="plan-return"
                    type="time"
                    value={returnTime}
                    disabled={!roundTrip}
                    onChange={(event) => setReturnTime(event.target.value)}
                    className="h-9 text-sm"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={roundTrip}
                  onChange={(event) => setRoundTrip(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Aller-retour (le retour est planifie automatiquement)
              </label>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={submit}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            {kind === 'once' ? 'Planifier' : 'Creer la routine'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
