// Historique mixte : une annulation conserve la trace et corrige les compteurs.
import { useState } from 'react';
import { Check } from 'lucide-react';
import type { PlannedTrip } from '../../../../types';
import type { TripDirection } from '../../../../contracts';
import type { RoutineHistoryDay, TripHistoryEntry } from '../../../../lib/trips/history';
import { formatCarbonComparison } from '../../../../lib/carbon-comparison';
import { useCancelRoutineDate, useRestoreRoutinePassage, useMarkTripDone } from '../../../../queries';
import { ConfirmDialog } from '../../../ui/confirm-dialog';
import { CancelTripButton } from '../CancelTripButton';
import { Button } from '../../../ui/button';
import { EmptyState, OriginDestination } from '../atoms';
import { formatScheduleLabel } from '../format';

function OnceHistoryCard({ trip }: { trip: PlannedTrip }) {
    const markDone = useMarkTripDone();
    const cancelled = trip.status === 'cancelled';
    return (
        <li className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-border/70 bg-background p-3">
            <p className="text-xs text-muted-foreground">Une fois · {formatScheduleLabel(trip.completedAt ?? trip.scheduledFor)}</p>
            <h3 className="truncate text-sm font-semibold">{trip.label}</h3>
            <OriginDestination origin={trip.origin.label} destination={trip.destination.label} />
            <p className="text-xs text-muted-foreground">
                {cancelled ? 'Annulé · exclu des calculs CO₂e' : trip.status === 'done'
                    ? `Fait · ${formatCarbonComparison(trip.carbonSavedGrams)}` : 'Passé · à confirmer, hors calculs CO₂e'}
            </p>
            {!cancelled ? (
                <div className="flex flex-wrap gap-2">
                    {trip.status === 'planned' ? (
                        <Button size="sm" onClick={() => markDone(trip)}><Check className="size-3.5" aria-hidden="true" />Fait</Button>
                    ) : null}
                    <CancelTripButton trip={trip} />
                </div>
            ) : null}
        </li>
    );
}

const DIRECTION_LABEL: Record<TripDirection, string> = { outbound: 'Aller', return: 'Retour' };
const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: 'UTC' });

function RoutineHistoryCard({ day }: { day: RoutineHistoryDay }) {
    return (
        <li className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-border/70 bg-background p-3">
            <p className="text-xs text-muted-foreground">Récurrent · {DAY_FORMAT.format(new Date(`${day.date}T12:00:00Z`))}</p>
            <h3 className="truncate text-sm font-semibold">{day.routine.label}</h3>
            <OriginDestination origin={day.routine.origin.label} destination={day.routine.destination.label} />
            <ul className="grid gap-1 text-xs">
                {day.passages.map((passage) => (
                    <li key={passage.direction} className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                            {DIRECTION_LABEL[passage.direction]} · {passage.direction === 'outbound' ? day.routine.departureTime : day.routine.returnTime}
                            {passage.cancelled ? ' · Annulé, hors calculs CO₂e' : ` · Compté automatiquement · ${formatCarbonComparison(day.routine.carbonSavedGrams)}`}
                        </span>
                    </li>
                ))}
            </ul>
            <RoutineHistoryActions day={day} />
        </li>
    );
}

function RoutineHistoryActions({ day }: { day: RoutineHistoryDay }) {
    const cancel = useCancelRoutineDate();
    const restore = useRestoreRoutinePassage();
    const [pending, setPending] = useState<TripDirection[]>([]);
    const remaining = day.passages.filter((passage) => !passage.cancelled).map((passage) => passage.direction);
    const cancelled = day.passages.filter((passage) => passage.cancelled);
    const selection = pending.map((direction) => DIRECTION_LABEL[direction].toLowerCase()).join(' et ');
    return (
        <div className="flex flex-wrap gap-2">
            {remaining.map((direction) => <Button key={direction} size="sm" variant="outline" onClick={() => setPending([direction])}>
                Annuler {direction === 'outbound' ? 'l’aller' : 'le retour'}
            </Button>)}
            {remaining.length === 2 ? <Button size="sm" variant="outline" onClick={() => setPending(remaining)}>Annuler les deux</Button> : null}
            {cancelled.map(({ direction }) => <Button key={direction} size="sm" variant="outline"
                onClick={() => restore({ id: day.routine.id, date: day.date, direction })}>
                Rétablir {direction === 'outbound' ? 'l’aller' : 'le retour'}
            </Button>)}
            {pending.length > 0 ? <ConfirmDialog open onOpenChange={(open) => { if (!open) setPending([]); }}
                title="Annuler ces passages ?"
                description={day.routine.label + " — " + DAY_FORMAT.format(new Date(day.date + "T12:00:00Z")) + " : " + selection + ". Ces passages seront exclus du bilan. Tu pourras les rétablir depuis cet historique."}
                confirmLabel="Confirmer l’annulation" destructive
                onConfirm={() => cancel({ id: day.routine.id, date: day.date, directions: pending })} /> : null}
        </div>
    );
}

export function HistoryList({ entries }: { entries: TripHistoryEntry[] }) {
    const [visibleCount, setVisibleCount] = useState(20);
    if (entries.length === 0) {
        return <EmptyState icon={<Check className="size-4" aria-hidden="true" />} title="Aucun trajet dans l’historique"
            hint="Les trajets ponctuels passés et les passages échus des récurrences apparaissent ici. Tu peux les annuler pour corriger ton bilan CO₂e." />;
    }
    return (
        <div className="grid min-w-0 grid-cols-1 gap-3">
            <p className="text-xs text-muted-foreground">Les récurrences comptent automatiquement après l’heure prévue. Annule ici un aller, un retour ou les deux si tu ne les as pas effectués.</p>
            <ul className="grid min-w-0 grid-cols-1 gap-2">
                {entries.slice(0, visibleCount).map((entry) => entry.kind === 'once'
                    ? <OnceHistoryCard key={entry.id} trip={entry.trip} />
                    : <RoutineHistoryCard key={entry.id} day={entry} />)}
            </ul>
            {entries.length > visibleCount ? (
                <Button variant="outline" onClick={() => setVisibleCount((count) => count + 20)}>Afficher les jours précédents</Button>
            ) : null}
        </div>
    );
}
