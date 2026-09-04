// Hub central des trajets : à venir, routines, historique, enregistrés.
// Le dialogue ne fait qu'aiguiller vers la liste correspondante ; chaque liste
// vit dans son propre fichier. Il lit les ressources du compte et déclenche
// leurs actions directement : rien ne transite par l'orchestrateur.
import { useEffect, useMemo, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { Search } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import type { SavedRouteRecord } from '../../../types';
import { completedTrips } from '../../../lib/trips';
import {
    useActivitySummary,
    useCancelTrip,
    useDeleteSavedRoute,
    useMarkTripDone,
    usePlannedTrips,
    useRecurringTrips,
    useRemoveRoutine,
    useRemoveTrip,
    useSavedRoutes,
    useToggleRoutinePaused,
    useUpcomingTrips,
} from '../../../queries';
import { planSourceAtom, tripsHubAtom, type TripsHubTab } from '../../../state';
import { Metric } from '../../app/shared';
import { TripGoalsCard } from './TripGoalsCard';
import { HistoryList } from './lists/HistoryList';
import { RecurringList } from './lists/RecurringList';
import { SavedList } from './lists/SavedList';
import { UpcomingList } from './lists/UpcomingList';

export type { TripsHubTab };

const HUB_TABS: Array<{ id: TripsHubTab; label: string }> = [
    { id: 'upcoming', label: 'À venir' },
    { id: 'recurring', label: 'Récurrents' },
    { id: 'history', label: 'Historique' },
    { id: 'saved', label: 'Enregistrés' },
];

export function TripsHubDialog({
    onNewTrip,
    onLoadSavedRoute,
}: {
    onNewTrip: () => void;
    /** Recharge un itinéraire enregistré sur la carte : l'orchestrateur tient le départ et l'arrivée. */
    onLoadSavedRoute: (route: SavedRouteRecord) => void;
}) {
    const [hub, setHub] = useAtom(tripsHubAtom);
    const plannedTrips = usePlannedTrips();
    const recurringTrips = useRecurringTrips();
    const savedRoutes = useSavedRoutes();
    const summary = useActivitySummary();
    const upcoming = useUpcomingTrips();
    const markDone = useMarkTripDone();
    const cancelTrip = useCancelTrip();
    const removeTrip = useRemoveTrip();
    const togglePaused = useToggleRoutinePaused();
    const removeRecurring = useRemoveRoutine();
    const deleteSavedRoute = useDeleteSavedRoute();
    const setPlanSource = useSetAtom(planSourceAtom);

    const [tab, setTab] = useState<TripsHubTab>(hub.tab);

    useEffect(() => {
        if (hub.open) {
            setTab(hub.tab);
        }
    }, [hub.open, hub.tab]);

    const history = useMemo(() => completedTrips(plannedTrips), [plannedTrips]);

    const counts: Record<TripsHubTab, number> = {
        upcoming: upcoming.length,
        recurring: recurringTrips.length,
        history: history.length,
        saved: savedRoutes.length,
    };

    const planSavedRoute = (entry: SavedRouteRecord) => {
        setPlanSource({
            label: entry.routeTitle,
            origin: entry.origin,
            destination: entry.destination,
            modes: entry.modes,
            distanceKm: entry.distanceKm,
            durationMinutes: entry.durationMinutes,
            carbonGrams: entry.carbonGrams,
            carbonSavedGrams: entry.carbonSavedGrams,
        });
    };

    return (
        <Dialog open={hub.open} onOpenChange={(open) => setHub({ ...hub, open })}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="font-display">Planificateur de trajets</DialogTitle>
                    <DialogDescription>Planifie, automatise et suis tes déplacements bas carbone.</DialogDescription>
                </DialogHeader>

                <div className="grid max-h-[calc(100dvh-14rem)] gap-3 overflow-y-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Metric label="Fait / semaine" value={String(summary.doneThisWeek)} compact />
                        <Metric label="CO₂e évité / sem." value={`${summary.savedThisWeekGrams} gCO₂e`} compact />
                        <Metric label="À venir" value={String(summary.upcomingCount)} compact />
                        <Metric label="Récurrents actifs" value={String(summary.recurringActiveCount)} compact />
                    </div>

                    <TripGoalsCard />

                    <Button type="button" className="h-11 w-full justify-center rounded-xl" onClick={onNewTrip}>
                        <Search className="size-4" aria-hidden="true" />
                        Nouveau trajet — choisir un départ et une arrivée
                    </Button>

                    <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Sections trajets">
                        {HUB_TABS.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === item.id}
                                className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition ${tab === item.id ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                onClick={() => setTab(item.id)}
                            >
                                {item.label}
                                <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${tab === item.id ? 'bg-primary/10 text-primary' : 'bg-background/60'}`}>
                                    {counts[item.id]}
                                </span>
                            </button>
                        ))}
                    </div>

                    {tab === 'upcoming' ? (
                        <UpcomingList trips={upcoming} onMarkDone={markDone} onCancelTrip={cancelTrip} onDeleteTrip={removeTrip} />
                    ) : null}
                    {tab === 'recurring' ? (
                        <RecurringList trips={recurringTrips} onTogglePaused={togglePaused} onDelete={removeRecurring} />
                    ) : null}
                    {tab === 'history' ? <HistoryList trips={history} /> : null}
                    {tab === 'saved' ? (
                        <SavedList routes={savedRoutes} onLoad={onLoadSavedRoute} onPlan={planSavedRoute} onDelete={deleteSavedRoute} />
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
