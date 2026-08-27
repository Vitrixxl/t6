// Hub central des trajets : a venir, routines, historique, enregistres.
// Le dialogue ne fait qu'aiguiller vers la liste correspondante ; chaque liste
// vit dans son propre fichier.
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../ui/dialog';
import type {
  MobilityProfile,
  PlannedTrip,
  RecurringTrip,
  SavedRouteRecord,
  SessionUser,
  TripActivitySummary,
} from '../../../types';
import { upcomingTrips, completedTrips } from '../../../lib/trips';
import { Metric } from '../../app/shared';
import { TripGoalsCard } from './TripGoalsCard';
import { HistoryList } from './lists/HistoryList';
import { RecurringList } from './lists/RecurringList';
import { SavedList } from './lists/SavedList';
import { UpcomingList } from './lists/UpcomingList';

export type TripsHubTab = 'upcoming' | 'recurring' | 'history' | 'saved';

const HUB_TABS: Array<{ id: TripsHubTab; label: string }> = [
  { id: 'upcoming', label: 'A venir' },
  { id: 'recurring', label: 'Recurrents' },
  { id: 'history', label: 'Historique' },
  { id: 'saved', label: 'Enregistres' },
];

export function TripsHubDialog({
  open,
  initialTab = 'upcoming',
  user,
  plannedTrips,
  recurringTrips,
  savedRoutes,
  summary,
  onOpenChange,
  onProfileSave,
  onNewTrip,
  onMarkDone,
  onCancelTrip,
  onDeleteTrip,
  onToggleRecurringPaused,
  onDeleteRecurring,
  onLoadSavedRoute,
  onPlanSavedRoute,
  onDeleteSavedRoute,
}: {
  open: boolean;
  initialTab?: TripsHubTab;
  user: SessionUser;
  plannedTrips: PlannedTrip[];
  recurringTrips: RecurringTrip[];
  savedRoutes: SavedRouteRecord[];
  summary: TripActivitySummary;
  onOpenChange: (open: boolean) => void;
  onProfileSave: (profile: MobilityProfile) => void;
  onNewTrip: () => void;
  onMarkDone: (trip: PlannedTrip) => void;
  onCancelTrip: (trip: PlannedTrip) => void;
  onDeleteTrip: (trip: PlannedTrip) => void;
  onToggleRecurringPaused: (trip: RecurringTrip) => void;
  onDeleteRecurring: (trip: RecurringTrip) => void;
  onLoadSavedRoute: (route: SavedRouteRecord) => void;
  onPlanSavedRoute: (route: SavedRouteRecord) => void;
  onDeleteSavedRoute: (id: string) => void;
}) {
  const [tab, setTab] = useState<TripsHubTab>(initialTab);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  const upcoming = useMemo(() => upcomingTrips(plannedTrips), [plannedTrips]);
  const history = useMemo(() => completedTrips(plannedTrips), [plannedTrips]);

  const counts: Record<TripsHubTab, number> = {
    upcoming: upcoming.length,
    recurring: recurringTrips.length,
    history: history.length,
    saved: savedRoutes.length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Planificateur de trajets</DialogTitle>
          <DialogDescription>Planifie, automatise et suis tes deplacements bas carbone.</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[calc(100dvh-14rem)] gap-3 overflow-y-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Fait / semaine" value={String(summary.doneThisWeek)} compact />
            <Metric label="CO2 evite / sem." value={`${summary.savedThisWeekGrams} g`} compact />
            <Metric label="A venir" value={String(summary.upcomingCount)} compact />
            <Metric label="Recurrents actifs" value={String(summary.recurringActiveCount)} compact />
          </div>

          <TripGoalsCard user={user} summary={summary} onProfileSave={onProfileSave} />

          <Button type="button" className="h-11 w-full justify-center rounded-xl" onClick={onNewTrip}>
            <Search className="size-4" aria-hidden="true" />
            Nouveau trajet — choisir un depart et une arrivee
          </Button>

          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Sections trajets">
            {HUB_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition ${
                  tab === item.id ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
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
            <UpcomingList trips={upcoming} onMarkDone={onMarkDone} onCancelTrip={onCancelTrip} onDeleteTrip={onDeleteTrip} />
          ) : null}
          {tab === 'recurring' ? (
            <RecurringList trips={recurringTrips} onTogglePaused={onToggleRecurringPaused} onDelete={onDeleteRecurring} />
          ) : null}
          {tab === 'history' ? <HistoryList trips={history} /> : null}
          {tab === 'saved' ? (
            <SavedList routes={savedRoutes} onLoad={onLoadSavedRoute} onPlan={onPlanSavedRoute} onDelete={onDeleteSavedRoute} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
