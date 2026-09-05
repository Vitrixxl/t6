import { useMemo, useState } from 'react';
import { ChartNoAxesCombined } from 'lucide-react';
import { useProfile, useRecurringTrips, useTripRecords } from '../../../queries';
import { useNow } from '../../../state/clock';
import { tripEvolution, type TripWeek } from '../../../lib/trip-evolution';
import { TRIP_HISTORY_LIMIT } from '../../../contracts/limits';
import { Button } from '../../ui/button';

const METRICS = [
    { key: 'carbonGrams', label: 'Émissions', unit: 'gCO₂e' },
    { key: 'carbonSavedGrams', label: 'CO₂e évité', unit: 'gCO₂e' },
    { key: 'distanceKm', label: 'Distance', unit: 'km' },
    { key: 'trips', label: 'Trajets', unit: 'trajets' },
] as const;
const DATE = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' });
const NUMBER = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function TripEvolution() {
    const [open, setOpen] = useState(false);
    const [metric, setMetric] = useState<typeof METRICS[number]>(METRICS[0]);
    const records = useTripRecords();
    const recurring = useRecurringTrips();
    const now = useNow();
    const budget = useProfile().carbonGoalGramsPerWeek;
    const weeks = useMemo(() => tripEvolution(records, recurring, now), [records, recurring, now]);
    const completeWeeks = weeks.slice(0, -1);
    const average = completeWeeks.reduce((sum, week) => sum + week[metric.key], 0) / completeWeeks.length;
    return (
        <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
            <Button variant="outline" aria-expanded={open} aria-controls="trip-evolution" onClick={() => setOpen(!open)}>
                <ChartNoAxesCombined className="size-4" aria-hidden="true" />{open ? 'Masquer l’évolution' : 'Voir l’évolution'}
            </Button>
            {open ? <div id="trip-evolution" className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-xl border border-border p-3">
                <h3 className="font-semibold">Évolution sur 8 semaines</h3>
                <p className="text-xs text-muted-foreground">Semaines du lundi au dimanche, dans le fuseau de cet appareil. La dernière est en cours.</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Indicateur du graphique">
                    {METRICS.map((item) => <Button key={item.key} size="sm" variant={metric.key === item.key ? 'default' : 'outline'}
                        aria-pressed={metric.key === item.key} onClick={() => setMetric(item)}>{item.label}</Button>)}
                </div>
                <p className="text-sm">Moyenne des 7 semaines terminées : <strong>{NUMBER.format(average)} {metric.unit} / semaine</strong></p>
                <WeeklyChart weeks={weeks} metric={metric} budget={budget} />
                <p className="text-xs text-muted-foreground">Trajets faits conservés (au plus {TRIP_HISTORY_LIMIT} ponctuels) et passages récurrents échus, hors annulations et pauses. Une semaine vide signifie aucune donnée comptabilisée. Les économies sans référence voiture sont exclues ; les valeurs négatives restent visibles.</p>
                <details className="text-xs">
                    <summary className="cursor-pointer font-semibold">Voir les valeurs par semaine</summary>
                    <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-right tabular-nums">
                            <caption className="sr-only">Évolution des déplacements conservés dans le compte</caption>
                            <thead><tr><th scope="col" className="text-left">Semaine du</th>{METRICS.map((item) => <th scope="col" className="p-2" key={item.key}>{item.label} ({item.unit})</th>)}</tr></thead>
                            <tbody>{weeks.map((week, index) => <tr key={week.start.toISOString()}>
                                <th scope="row" className="py-2 text-left font-normal">{DATE.format(week.start)}{index === 7 ? ' (en cours)' : ''}</th>
                                {METRICS.map((item) => <td className="p-2" key={item.key}>{NUMBER.format(week[item.key])}</td>)}
                            </tr>)}</tbody>
                        </table>
                    </div>
                </details>
            </div> : null}
        </section>
    );
}

function WeeklyChart({ weeks, metric, budget }: { weeks: TripWeek[]; metric: typeof METRICS[number]; budget: number }) {
    const values = weeks.map((week) => week[metric.key]);
    const ceiling = metric.key === 'carbonGrams' ? budget : 0;
    const max = Math.max(1, ceiling, ...values);
    const min = Math.min(0, ...values);
    const y = (value: number) => 180 - (value - min) / (max - min) * 140;
    return (
        <figure className="min-w-0">
            <svg viewBox="0 0 480 215" className="w-full" role="img" aria-label={`${metric.label} par semaine, en ${metric.unit}. Valeurs détaillées dans le tableau.`}>
                <line x1="10" x2="470" y1={y(0)} y2={y(0)} stroke="currentColor" opacity="0.35" />
                {metric.key === 'carbonGrams' ? <g>
                    <line x1="10" x2="470" y1={y(budget)} y2={y(budget)} stroke="currentColor" strokeDasharray="5 4" />
                    <text x="10" y="14" fontSize="12" fill="currentColor">Maximum actuel : {NUMBER.format(budget)} gCO₂e</text>
                </g> : null}
                {weeks.map((week, index) => <g key={week.start.toISOString()}>
                    <rect x={15 + index * 58} y={Math.min(y(0), y(week[metric.key]))} width="38"
                        height={Math.abs(y(week[metric.key]) - y(0))} fill="currentColor" className={index === 7 ? 'text-primary/50' : 'text-primary'} />
                    <text x={34 + index * 58} y={week[metric.key] >= 0 ? y(week[metric.key]) - 5 : y(week[metric.key]) + 13}
                        textAnchor="middle" fontSize="11" fill="currentColor">{NUMBER.format(week[metric.key])}</text>
                    <text x={34 + index * 58} y="208" textAnchor="middle" fontSize="12" fill="currentColor">{DATE.format(week.start)}</text>
                </g>)}
            </svg>
            <figcaption className="text-xs text-muted-foreground">{metric.label} ({metric.unit}) · début de chaque semaine. Dernière barre : semaine incomplète.{metric.key === 'carbonGrams' ? ' Le maximum est celui du profil actuel, sans historique des changements.' : ''}</figcaption>
        </figure>
    );
}
