// Trajets dates à venir : marquer fait, annuler, supprimer.
import { CancelTripButton } from '../CancelTripButton';
import { useState } from 'react';
import { ConfirmDialog } from '../../../ui/confirm-dialog';
import { formatDuration } from '../../../../lib/duration';
import { CalendarClock, Check, Leaf, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import type { PlannedTrip } from '../../../../types';
import { formatCarbonComparison } from '../../../../lib/carbon-comparison';
import { EmptyState, ModeIconRow, OriginDestination, TripStatusDot } from '../atoms';
import { formatScheduleLabel } from '../format';

export function UpcomingList({
    trips,
    onMarkDone,
    onDeleteTrip,
}: {
    trips: PlannedTrip[];
    onMarkDone: (trip: PlannedTrip) => void;
    onDeleteTrip: (trip: PlannedTrip) => void;
}) {
    const [pendingDelete, setPendingDelete] = useState<PlannedTrip | null>(null);
    if (trips.length === 0) {
        return (
            <EmptyState
                icon={<CalendarClock className="size-4" aria-hidden="true" />}
                title="Aucun trajet à venir"
                hint="Calcule un itinéraire puis « Planifier » pour le dater. Les routines, elles, comptent toutes seules : voir l'onglet Récurrents."
            />
        );
    }

    return (
        <>
            <ul className="grid min-w-0 grid-cols-1 gap-2">
                {trips.map((trip) => (
                    <li key={trip.id} className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-border/70 bg-background p-3">
                        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                            <div className="min-w-0 max-w-full">
                                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
                                    <TripStatusDot status={trip.status} />
                                    {formatScheduleLabel(trip.scheduledFor)}
                                </p>
                                <h3 className="mt-0.5 truncate text-sm font-semibold">{trip.label}</h3>
                                <OriginDestination origin={trip.origin.label} destination={trip.destination.label} />
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:shrink-0 sm:flex-col sm:items-end sm:text-right">
                                <span className="font-mono text-[11px] text-muted-foreground">
                                    {formatDuration(trip.durationMinutes)} · {trip.distanceKm.toFixed(1)} km
                                </span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                                    <Leaf className="size-3" aria-hidden="true" />
                                    {formatCarbonComparison(trip.carbonSavedGrams)}
                                </span>
                                <ModeIconRow trip={trip} />
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button type="button" size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => onMarkDone(trip)}>
                                <Check className="size-3.5" aria-hidden="true" />
                                Fait
                            </Button>
                            <CancelTripButton trip={trip} />
                            <span className="flex-1" aria-hidden="true" />
                            <Button
                                type="button"
                                variant="ghost"
                                size="compactIcon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => setPendingDelete(trip)}
                                aria-label={`Supprimer ${trip.label}`}
                            >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                        </div>
                    </li>
                ))}
            </ul>
            {pendingDelete && (
                <ConfirmDialog
                    open
                    onOpenChange={() => setPendingDelete(null)}
                    title="Supprimer ce trajet ?"
                    description={`« ${pendingDelete.label} » — Ce trajet planifié sera supprimé. Cette action est définitive.`}
                    confirmLabel="Supprimer"
                    destructive
                    onConfirm={() => onDeleteTrip(pendingDelete)}
                />
            )}
        </>
    );
}
