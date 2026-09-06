// Étapes d'un itinéraire : un segment par ligne.
//
// Les étapes affichées sont les segments du trajet, pas les manœuvres du
// calculateur d'itinéraires. Ce que l'utilisateur a besoin de savoir avant de
// partir, c'est l'enchaînement — marcher jusqu'à la station, prendre le vélo,
// marcher jusqu'à l'arrêt, prendre le métro — et non « tourner à droite dans
// 80 m », qui relève du guidage pas-à-pas et n'a de sens qu'en chemin.
//
import { Clock3 } from 'lucide-react';
import { formatClockTime, formatDuration } from '../../lib/duration';
import type { RouteLeg, RouteOption } from '../../types';
import { formatDistance, visibleLegs } from '../../lib/planner';
import { legColor, legTextColor } from '../map/legStyle';
import { LegIcon } from './RouteSequence';

function StepRow({ leg, last }: { leg: RouteLeg; last: boolean }) {
    const color = legColor(leg);
    // Le nom de ligne est déjà porté par la pastille : le répéter dans le titre
    // donnerait "Métro D Métro D vers Vénissieux".
    const title = leg.mapLabel && leg.title.startsWith(leg.mapLabel) ? leg.title.slice(leg.mapLabel.length).trim() : leg.title;

    return (
        <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3">
            <div className="flex flex-col items-center">
                <span
                    className="grid size-7 shrink-0 place-items-center rounded-lg text-white"
                    style={{ background: color, color: legTextColor(leg) }}
                >
                    <LegIcon leg={leg} className="size-3.5" />
                </span>
                {/* Le filet relie visuellement les étapes : on lit une suite, pas une
            liste de cartes indépendantes. */}
                {last ? null : <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" />}
            </div>

            <div className={`min-w-0 ${last ? '' : 'pb-3'}`}>
                <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <strong className="truncate text-[0.82rem] font-semibold leading-5">
                        {leg.mapLabel ? (
                            <span
                                className="mr-1.5 inline-block rounded px-1.5 py-0.5 align-middle text-[0.62rem] font-bold uppercase tracking-wide text-white"
                                style={{ background: color, color: legTextColor(leg) }}
                            >
                                {leg.mapLabel}
                            </span>
                        ) : null}
                        {title}
                    </strong>
                    {/* Une correspondance interne n'a pas de distance fiable dans le
              GTFS. Afficher "0 m" ferait passer une absence de donnée pour
              une mesure ; sa durée estimée suffit. */}
                    <span className="shrink-0 font-mono text-[0.68rem] text-muted-foreground">
                        {leg.transfer ? `${formatDuration(leg.durationMinutes)}` : (
                            <>{formatDistance(leg.distanceKm)} &middot; {formatDuration(leg.durationMinutes)}</>
                        )}
                    </span>
                </div>
                <p className="mt-0.5 truncate text-[0.72rem] leading-4 text-muted-foreground">
                    {leg.from} <span aria-hidden="true">&rarr;</span> {leg.to}
                </p>
                <BoardingTime leg={leg} />
                {leg.mode === 'transit' ? <p className="mt-1 text-[0.72rem] leading-4 text-muted-foreground">{leg.detail}</p> : null}
            </div>
        </li>
    );
}

export function RouteSteps({ routeOption }: { routeOption: RouteOption }) {
    const legs = visibleLegs(routeOption);
    if (legs.length === 0) {
        return null;
    }

    return (
        <section aria-label="Étapes de l'itinéraire">
            <h3 className="mb-2 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Étapes
            </h3>
            <ol className="m-0 list-none p-0">
                {legs.map((leg, index) => (
                    <StepRow key={leg.id} leg={leg} last={index === legs.length - 1} />
                ))}
            </ol>
        </section>
    );
}

export function BoardingTime({ leg }: { leg: RouteLeg }) {
    if (leg.mode !== 'transit') return null;
    const wait = leg.waitingSeconds === undefined ? 'indisponible' : leg.waitingSeconds === 0 ? '0 min' : leg.waitingSeconds < 60 ? 'moins d’1 min' : formatDuration(Math.ceil(leg.waitingSeconds / 60));
    return (
        <span className="mt-1 flex flex-wrap items-center gap-x-1 text-xs font-medium">
            <Clock3 className="size-3.5" aria-hidden="true" />
            <span>Attente : {wait}</span>
            {leg.boardingAt ? <span>· Départ à {formatClockTime(leg.boardingAt)}</span> : null}
        </span>
    );
}
