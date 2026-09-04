// Bloc trajets du rail lateral : raccourcis vers le hub et prochaines echeances.
import { useSetAtom } from 'jotai';
import { CalendarClock, Check, ChevronRight } from 'lucide-react';
import { Button } from '../../ui/button';
import { useActivitySummary, useMarkTripDone, useUpcomingTrips } from '../../../queries';
import { openHubAtom } from '../../../state';
import { Metric } from '../../app/shared';
import { formatScheduleLabel } from './format';

export function TripsSidebarSection() {
  const summary = useActivitySummary();
  const upcoming = useUpcomingTrips();
  const markDone = useMarkTripDone();
  const openHub = useSetAtom(openHubAtom);

  return (
    <div className="grid gap-2 px-3 pb-4">
      {/* CTA principal de l'application : le planificateur. */}
      <button
        type="button"
        onClick={() => openHub('upcoming')}
        className="group grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-primary p-3 text-left text-primary-foreground shadow-card transition hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--lime)] text-[var(--lime-foreground)] shadow-soft">
          <CalendarClock className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-semibold leading-tight tracking-tight">Ouvrir le planificateur</span>
          <span className="block truncate text-[11px] font-medium text-primary-foreground/75">
            {summary.upcomingCount > 0
              ? `${summary.upcomingCount} trajet${summary.upcomingCount > 1 ? 's' : ''} a venir · ${summary.recurringActiveCount} routine${summary.recurringActiveCount > 1 ? 's' : ''} active${summary.recurringActiveCount > 1 ? 's' : ''}`
              : 'Dates, routines, objectifs et historique'}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-primary-foreground/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </button>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Fait / semaine" value={String(summary.doneThisWeek)} compact />
        <Metric label="CO₂e évité" value={`${summary.savedThisWeekGrams} gCO₂e`} compact />
      </div>

      {upcoming.length > 0 ? (
        <ul className="grid gap-1.5">
          {upcoming.slice(0, 3).map((trip) => (
            <li key={trip.id} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/75 py-1.5 pl-2.5 pr-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.05em] text-primary">
                  {formatScheduleLabel(trip.scheduledFor)}
                </p>
                <p className="truncate text-xs font-semibold">{trip.label}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="compactIcon"
                className="h-7 w-7 shrink-0 text-primary"
                onClick={() => markDone(trip)}
                aria-label={`Marquer fait : ${trip.label}`}
                title="Marquer fait"
              >
                <Check className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-background/60 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
          Aucun trajet planifie. Calcule un itineraire puis « Planifier ».
        </p>
      )}
    </div>
  );
}
