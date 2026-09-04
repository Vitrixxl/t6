// Itineraires enregistres : reprogrammer ou supprimer.
import { CalendarPlus, Route, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import type { SavedRouteRecord } from '../../../../types';
import { EmptyState, OriginDestination } from '../atoms';

export function SavedList({
    routes,
    onLoad,
    onPlan,
    onDelete,
}: {
    routes: SavedRouteRecord[];
    onLoad: (route: SavedRouteRecord) => void;
    onPlan: (route: SavedRouteRecord) => void;
    onDelete: (id: string) => void;
}) {
    if (routes.length === 0) {
        return (
            <EmptyState
                icon={<Route className="size-4" aria-hidden="true" />}
                title="Aucun itineraire enregistre"
                hint="Enregistre un itineraire calcule pour le retrouver ici et le planifier en un clic."
            />
        );
    }

    return (
        <ul className="grid gap-2">
            {routes.map((route) => (
                <li key={route.id} className="grid gap-2 rounded-xl border border-border/70 bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold">{route.routeTitle}</h3>
                            <OriginDestination origin={route.origin.label} destination={route.destination.label} />
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground">
                            {route.durationMinutes} min · {route.distanceKm.toFixed(1)} km · {route.carbonGrams} gCO₂e
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button type="button" size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => onPlan(route)}>
                            <CalendarPlus className="size-3.5" aria-hidden="true" />
                            Planifier
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => onLoad(route)}>
                            <Route className="size-3.5" aria-hidden="true" />
                            Charger
                        </Button>
                        <span className="flex-1" aria-hidden="true" />
                        <Button
                            type="button"
                            variant="ghost"
                            size="compactIcon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => onDelete(route.id)}
                            aria-label={`Supprimer ${route.routeTitle}`}
                        >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                    </div>
                </li>
            ))}
        </ul>
    );
}
