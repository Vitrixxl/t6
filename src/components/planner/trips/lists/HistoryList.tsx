// Trajets faits ou annulés : lecture seule.
import { Check, Leaf } from 'lucide-react';
import type { PlannedTrip } from '../../../../types';
import { formatCarbonComparison } from '../../../../lib/carbon-comparison';
import { EmptyState, OriginDestination } from '../atoms';
import { formatScheduleLabel } from '../format';

export function HistoryList({ trips }: { trips: PlannedTrip[] }) {
    if (trips.length === 0) {
        return (
            <EmptyState
                icon={<Check className="size-4" aria-hidden="true" />}
                title="Aucun trajet fait pour le moment"
                hint="Marque un trajet planifié comme « Fait » : il alimente ici ton historique, tes stats et le suivi carbone. Les passages des routines comptent dans les stats sans passer par ici."
            />
        );
    }

    return (
        <ul className="grid gap-2">
            {trips.map((trip) => (
                <li key={trip.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-muted-foreground">
                            {formatScheduleLabel(trip.completedAt ?? trip.scheduledFor)}
                        </p>
                        <h3 className="truncate text-sm font-semibold">{trip.label}</h3>
                        <OriginDestination origin={trip.origin.label} destination={trip.destination.label} />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <Leaf className="size-3" aria-hidden="true" />
                            {formatCarbonComparison(trip.carbonSavedGrams)}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{trip.distanceKm.toFixed(1)} km</span>
                    </div>
                </li>
            ))}
        </ul>
    );
}
