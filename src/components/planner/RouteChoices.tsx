import { Check } from 'lucide-react';
import type { RouteOption } from '../../types';
import { formatClockTime, formatDuration } from '../../lib/duration';
import { RouteSequence } from './RouteSequence';
import { useRouteSelection } from './useRouteSelection';

export function RouteChoices({ options, queryKey }: { options: RouteOption[]; queryKey: string }) {
    const { route, selectRoute } = useRouteSelection(options, queryKey);
    if (options.length === 0) return null;
    return (
        <section aria-label="Choix des trajets" className="min-w-0 shrink-0">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {options.length} trajet{options.length > 1 ? 's' : ''} disponible{options.length > 1 ? 's' : ''} · arrivée la plus tôt en premier
            </p>
            <div key={queryKey} className="flex snap-x gap-2 overflow-x-auto pb-2" role="group" aria-label="Trajets disponibles">
                {options.map((option, index) => {
                    const selected = option.id === route?.id;
                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={selected}
                            aria-label={`Trajet ${index + 1} : ${option.title}, arrivée à ${formatClockTime(option.arrivalAt)}, ${formatDuration(option.durationMinutes)}`}
                            onClick={() => selectRoute(option.id)}
                            className={`w-[min(19rem,80vw)] shrink-0 snap-start rounded-xl border p-3 text-left ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground'}`}
                        >
                            <span className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                <span>{index === 0 ? 'Le plus rapide' : `Trajet ${index + 1}`}</span>
                                {selected ? <Check className="size-4" aria-hidden="true" /> : null}
                            </span>
                            <strong className="mt-1 block text-sm">{option.title}</strong>
                            <RouteSequence route={option} />
                            <span className="block font-mono text-[11px]">
                                {formatClockTime(option.departureAt)} → {formatClockTime(option.arrivalAt)} · {formatDuration(option.durationMinutes)} · {option.distanceKm.toFixed(1)} km
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
