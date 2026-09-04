// Routines : mise en pause, reprise, suppression.
//
// Une routine n'a pas d'occurrences a cocher : chaque passage deja echu compte
// de lui-meme. La carte le montre en annonçant le prochain passage et le
// nombre de passages comptes cette semaine.
import { Pause, Play, Repeat, Trash2 } from 'lucide-react';
import { Button } from '../../../ui/button';
import type { RecurringTrip } from '../../../../types';
import { WEEKDAY_LABELS, countOccurrences, isRoutinePaused, nextOccurrence, startOfWeek } from '../../../../lib/trips';
import { EmptyState, ModeIconRow, OriginDestination } from '../atoms';
import { formatScheduleLabel } from '../format';

export function RecurringList({
    trips,
    onTogglePaused,
    onDelete,
}: {
    trips: RecurringTrip[];
    onTogglePaused: (trip: RecurringTrip) => void;
    onDelete: (trip: RecurringTrip) => void;
}) {
    if (trips.length === 0) {
        return (
            <EmptyState
                icon={<Repeat className="size-4" aria-hidden="true" />}
                title="Aucun trajet recurrent"
                hint="Automatise tes deplacements reguliers (ex: aller-retour au travail) : chaque passage prevu compte de lui-meme dans tes objectifs et ton suivi carbone."
            />
        );
    }

    const now = new Date();
    const weekFloor = startOfWeek(now);

    return (
        <ul className="grid gap-2">
            {trips.map((trip) => {
                const paused = isRoutinePaused(trip);
                const next = nextOccurrence(trip, now);
                const thisWeek = countOccurrences(trip, weekFloor, now);
                return (
                    <li
                        key={trip.id}
                        className={`grid gap-2.5 rounded-xl border p-3 transition ${paused ? 'border-border/60 bg-muted/30 opacity-80' : 'border-border/70 bg-background'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="flex items-center gap-2 truncate text-sm font-semibold">
                                    {trip.label}
                                    {paused ? (
                                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                                            en pause
                                        </span>
                                    ) : null}
                                </h3>
                                <OriginDestination origin={trip.origin.label} destination={trip.destination.label} />
                                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                                    Depart {trip.departureTime}
                                    {trip.returnTime ? ` · retour ${trip.returnTime}` : ''}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    {next ? `Prochain passage : ${formatScheduleLabel(next.toISOString(), now)}` : 'Aucun passage prevu'}
                                    {` · ${thisWeek} passage${thisWeek > 1 ? 's' : ''} cette semaine`}
                                </p>
                            </div>
                            <ModeIconRow trip={trip} />
                        </div>
                        <div className="flex items-center gap-1" aria-label="Jours actifs">
                            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                                <span
                                    key={day}
                                    className={`grid h-6 w-7 place-items-center rounded-md text-[10px] font-bold ${trip.daysOfWeek.includes(day)
                                        ? paused
                                            ? 'bg-muted text-muted-foreground'
                                            : 'bg-primary/10 text-primary'
                                        : 'text-muted-foreground/40'
                                        }`}
                                >
                                    {WEEKDAY_LABELS[day][0]}
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Button
                                type="button"
                                variant={paused ? 'default' : 'outline'}
                                size="sm"
                                className="h-7 px-2.5 text-[11px]"
                                onClick={() => onTogglePaused(trip)}
                            >
                                {paused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
                                {paused ? 'Reprendre' : 'Mettre en pause'}
                            </Button>
                            <span className="flex-1" aria-hidden="true" />
                            <Button
                                type="button"
                                variant="ghost"
                                size="compactIcon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => onDelete(trip)}
                                aria-label={`Supprimer le trajet recurrent ${trip.label}`}
                            >
                                <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}
