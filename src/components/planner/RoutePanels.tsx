// Module planification - restitution desktop : détail du trajet retenu et
// barre de statut des sources.
import { formatClockTime, formatDuration } from '../../lib/duration';
import { CalendarPlus, Check, Route, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/button';
import type { RouteOption } from '../../types';
import { ROUTING_STATUS_LABEL, type RoutingStatus } from '../app/hooks/useFastestRoute';
import { RouteSequence, LegIcon } from './RouteSequence';
import { BoardingTime } from './RouteSteps';
import { visibleLegs } from '../../lib/planner';
import { formatCarbonComparison, formatCarbonFootprint } from '../../lib/carbon-comparison';
import { Metric } from '../app/shared';

export function MapStatusBar({
    routingStatus,
    geoStatus }: {
        routingStatus: RoutingStatus;
        geoStatus: string;
    }) {
    return (
        <div className="inline-flex shrink-0 items-stretch overflow-hidden rounded-xl bg-muted/35">
            <div className="inline-flex h-9 items-center gap-2 px-3">
                <span className="text-[8px] text-muted-foreground">Routage</span>
                <span
                    className={`font-mono text-[10.5px] leading-none ${routingStatus === 'unavailable' ? 'text-destructive' : 'text-foreground'
                        }`}
                >
                    {ROUTING_STATUS_LABEL[routingStatus]}
                </span>
            </div>
            <div className="inline-flex h-9 items-center gap-2 border-l border-foreground/10 px-3">
                <span className="text-[8px] text-muted-foreground">GPS</span>
                <span className="font-mono text-[10.5px] leading-none text-foreground">{geoStatus}</span>
            </div>
        </div>
    );
}

export function RouteDetailPanel({
    routeOption,
    saved,
    onSave,
    onPlan }: {
        routeOption: RouteOption;
        saved: boolean;
        onSave: () => void;
        onPlan: () => void;
    }) {
    return (
        <section className="shrink-0 overflow-hidden rounded-xl border border-primary/80 bg-muted/20">
            <div className="border-b border-border/50 px-3 py-3">
                <div className="mb-2 flex min-w-0 items-center gap-2">
                    <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    <span className="truncate text-[11px] font-semibold text-emerald-700">
                        {routeOption.accessible ? 'PMR compatible' : 'PMR limité'}
                    </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Trajet le plus rapide</p>
                <h2 className="truncate text-[15px] font-semibold tracking-normal">{routeOption.title}</h2>
                <RouteSequence route={routeOption} />
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{routeOption.summary}</p>
            </div>
            <div className="grid gap-3 p-3">
                <div className="grid grid-cols-3 gap-2">
                    <Metric label="Départ" value={formatClockTime(routeOption.departureAt)} />
                    <Metric label="Arrivée" value={formatClockTime(routeOption.arrivalAt)} />
                    <Metric label="Durée" value={formatDuration(routeOption.durationMinutes)} />
                    <Metric label="Distance" value={`${routeOption.distanceKm.toFixed(1)} km`} />
                    <Metric label="Empreinte" value={formatCarbonFootprint(routeOption.carbonGrams)} />
                    <Metric label="Vs voiture" value={formatCarbonComparison(routeOption.carbonSavedGrams)} />
                </div>
                <ol className="grid gap-2">
                    {visibleLegs(routeOption).map((leg) => {
                        return (
                            <li key={leg.id} className="grid grid-cols-[30px_1fr] gap-2.5 rounded-lg border border-border/70 bg-background/70 p-2.5">
                                <span className="grid size-7 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                                    <LegIcon leg={leg} className="size-4" />
                                </span>
                                <span>
                                    <strong className="block text-sm">{leg.title}</strong>
                                    <span className="block text-xs text-muted-foreground">
                                        {leg.from}
                                        {' -> '}
                                        {leg.to}. {leg.detail}
                                    </span>
                                    <BoardingTime leg={leg} />
                                </span>
                            </li>
                        );
                    })}
                </ol>
                <div className="grid grid-cols-2 gap-2">
                    <Button type="button" onClick={onPlan}>
                        <CalendarPlus className="size-4" aria-hidden="true" />
                        Planifier
                    </Button>
                    <Button type="button" variant="outline" onClick={onSave}>
                        {saved ? <Check className="size-4" aria-hidden="true" /> : <Route className="size-4" aria-hidden="true" />}
                        {saved ? 'Enregistré' : 'Enregistrer'}
                    </Button>
                </div>
            </div>
        </section>
    );
}
