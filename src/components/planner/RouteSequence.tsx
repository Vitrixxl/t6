import { ArrowRight, Bus, CableCar, TrainFront, TramFront } from 'lucide-react';
import type { RouteLeg, RouteOption } from '../../types';
import { MODE_ICON } from '../app/shared';
import { legColor, legTextColor } from '../map/legStyle';

const TRANSIT_ICON = { 0: TramFront, 1: TrainFront, 3: Bus, 7: CableCar };

export function LegIcon({ leg, className }: { leg: RouteLeg; className: string }) {
    const Icon = leg.mode === 'transit' ? TRANSIT_ICON[leg.transitType ?? 3] : MODE_ICON[leg.mode];
    return <Icon className={className} aria-hidden="true" />;
}

/** Les libellés restent accessibles aux lecteurs d'écran ; le résumé visuel est iconographique. */
export function RouteSequence({ route }: { route: RouteOption }) {
    const legs = route.legs.filter((leg, index) => leg.mode !== 'walk' || index === 0 || route.legs[index - 1].mode !== 'walk');
    return (
        <ol aria-label="Moyens de transport du trajet" className="my-2 flex flex-wrap items-center gap-x-1.5 gap-y-2">
            {legs.map((leg, index) => (
                <li key={leg.id} className="flex items-center gap-1.5">
                    {index > 0 ? <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden="true" /> : null}
                    <span
                        title={leg.mapLabel ?? leg.title}
                        className="inline-flex min-h-7 items-center gap-1 rounded-md px-1.5"
                        style={{ background: legColor(leg), color: legTextColor(leg) }}
                    >
                        <LegIcon leg={leg} className="size-4" />
                        <span className="sr-only">{leg.mapLabel ?? leg.title}</span>
                        {leg.lineCode ? <span className="text-xs font-bold" aria-hidden="true">{leg.lineCode}</span> : null}
                    </span>
                </li>
            ))}
        </ol>
    );
}
