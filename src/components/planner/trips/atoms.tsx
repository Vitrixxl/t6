// Briques d'affichage partagees par les vues du module trajets : elles n'ont
// aucune logique metier, uniquement une representation coherente.
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PlannedTrip } from '../../../types';
import { MODE_ICON } from '../../app/shared';

export function TripStatusDot({ status }: { status: PlannedTrip['status'] }) {
    const tone = status === 'done' ? 'bg-primary' : status === 'cancelled' ? 'bg-muted-foreground/40' : 'bg-[var(--lime)]';
    return <span className={`size-2 shrink-0 rounded-full ${tone}`} aria-hidden="true" />;
}

export function ModeIconRow({ trip }: { trip: { modes: PlannedTrip['modes'] } }) {
    return (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
            {trip.modes.map((mode) => {
                const Icon = MODE_ICON[mode];
                return <Icon key={mode} className="size-3.5" aria-hidden="true" />;
            })}
        </span>
    );
}

export function OriginDestination({ origin, destination }: { origin: string; destination: string }) {
    return (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{origin}</span>
            <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{destination}</span>
        </span>
    );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
    return (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <span className="mx-auto grid size-9 place-items-center rounded-xl bg-background text-muted-foreground shadow-soft">{icon}</span>
            <p className="mt-3 text-sm font-semibold">{title}</p>
            <p className="mx-auto mt-1 max-w-[26rem] text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
    );
}
