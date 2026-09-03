// Trajets dates a venir : marquer fait, annuler, supprimer.
import { CalendarClock, Check, Leaf, Trash2, X } from 'lucide-react';
import { Button } from '../../../ui/button';
import type { PlannedTrip } from '../../../../types';
import { EmptyState, ModeIconRow, OriginDestination, TripStatusDot } from '../atoms';
import { formatScheduleLabel } from '../format';

export function UpcomingList({
  trips,
  onMarkDone,
  onCancelTrip,
  onDeleteTrip,
}: {
  trips: PlannedTrip[];
  onMarkDone: (trip: PlannedTrip) => void;
  onCancelTrip: (trip: PlannedTrip) => void;
  onDeleteTrip: (trip: PlannedTrip) => void;
}) {
  if (trips.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-4" aria-hidden="true" />}
        title="Aucun trajet a venir"
        hint="Calcule un itineraire puis « Planifier » pour le dater. Les routines, elles, comptent toutes seules : voir l'onglet Recurrents."
      />
    );
  }

  return (
    <ul className="grid gap-2">
      {trips.map((trip) => (
        <li key={trip.id} className="grid gap-2 rounded-xl border border-border/70 bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
                <TripStatusDot status={trip.status} />
                {formatScheduleLabel(trip.scheduledFor)}
              </p>
              <h3 className="mt-0.5 truncate text-sm font-semibold">{trip.label}</h3>
              <OriginDestination origin={trip.origin.label} destination={trip.destination.label} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span className="font-mono text-[11px] text-muted-foreground">
                {trip.durationMinutes} min · {trip.distanceKm.toFixed(1)} km
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Leaf className="size-3" aria-hidden="true" />-{trip.carbonSavedGrams} g CO2
              </span>
              <ModeIconRow trip={trip} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => onMarkDone(trip)}>
              <Check className="size-3.5" aria-hidden="true" />
              Fait
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => onCancelTrip(trip)}
            >
              <X className="size-3.5" aria-hidden="true" />
              Annuler
            </Button>
            <span className="flex-1" aria-hidden="true" />
            <Button
              type="button"
              variant="ghost"
              size="compactIcon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onDeleteTrip(trip)}
              aria-label={`Supprimer ${trip.label}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
