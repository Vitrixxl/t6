// Module planification - trajets : hub central (a venir, recurrents, historique,
// enregistres), objectifs utilisateur et formulaire de planification.
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  Leaf,
  Pause,
  Play,
  Repeat,
  Route,
  Search,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type {
  MobilityProfile,
  PlannedTrip,
  RecurringTrip,
  SavedRouteRecord,
  SessionUser,
  TripActivitySummary,
} from '../../types';
import { WEEKDAY_LABELS, upcomingTrips, completedTrips, type TripSource } from '../../lib/plannedTrips';
import { MODE_ICON, Metric } from '../app/shared';

export const DEFAULT_WEEKLY_TRIPS_GOAL = 5;
export const DEFAULT_WEEKLY_SAVED_GOAL_GRAMS = 2000;

// ---------------------------------------------------------------------------
// Formats de dates centralises (fr, concis, coherents partout).

const DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const FULL_DAY_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function formatScheduleLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const dayDelta = Math.floor(
    (new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
  const day = dayDelta === 0 ? "Aujourd'hui" : dayDelta === 1 ? 'Demain' : dayDelta === -1 ? 'Hier' : DAY_FORMAT.format(date);
  return `${day} · ${TIME_FORMAT.format(date)}`;
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Briques partagees du module trajets.

export function TripStatusDot({ status }: { status: PlannedTrip['status'] }) {
  const tone = status === 'done' ? 'bg-primary' : status === 'cancelled' ? 'bg-muted-foreground/40' : 'bg-[var(--lime)]';
  return <span className={`size-2 shrink-0 rounded-full ${tone}`} aria-hidden="true" />;
}

function ModeIconRow({ trip }: { trip: { modes: PlannedTrip['modes'] } }) {
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      {trip.modes.map((mode) => {
        const Icon = MODE_ICON[mode];
        return <Icon key={mode} className="size-3.5" aria-hidden="true" />;
      })}
    </span>
  );
}

function OriginDestination({ origin, destination }: { origin: string; destination: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="truncate">{origin}</span>
      <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{destination}</span>
    </span>
  );
}

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
      <span className="mx-auto grid size-9 place-items-center rounded-xl bg-background text-muted-foreground shadow-soft">{icon}</span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mx-auto mt-1 max-w-[26rem] text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}

function GoalRow({
  label,
  value,
  goal,
  unit,
  editing,
  onGoalChange,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  editing: boolean;
  onGoalChange: (next: number) => void;
}) {
  const percent = goal > 0 ? Math.min(Math.round((value / goal) * 100), 100) : 0;
  const reached = goal > 0 && value >= goal;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        {editing ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
            {value} /
            <Input
              type="number"
              min={1}
              value={goal}
              onChange={(event) => onGoalChange(Number(event.target.value))}
              className="h-7 w-20 px-2 text-right text-xs"
              aria-label={`Objectif ${label}`}
            />
            {unit}
          </span>
        ) : (
          <span className={`font-semibold tabular-nums ${reached ? 'text-primary' : 'text-muted-foreground'}`}>
            {value} / {goal} {unit}
          </span>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          className={`block h-full rounded-full transition-[width] duration-500 ${reached ? 'bg-[var(--lime)]' : 'bg-primary'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Objectifs et stats de la semaine.

export function TripGoalsCard({
  user,
  summary,
  onProfileSave,
}: {
  user: SessionUser;
  summary: TripActivitySummary;
  onProfileSave: (profile: MobilityProfile) => void;
}) {
  const tripsGoal = user.profile.weeklyTripsGoal ?? DEFAULT_WEEKLY_TRIPS_GOAL;
  const savedGoal = user.profile.weeklySavedGoalGrams ?? DEFAULT_WEEKLY_SAVED_GOAL_GRAMS;
  const [editing, setEditing] = useState(false);
  const [draftTripsGoal, setDraftTripsGoal] = useState(tripsGoal);
  const [draftSavedGoal, setDraftSavedGoal] = useState(savedGoal);

  useEffect(() => {
    setDraftTripsGoal(tripsGoal);
    setDraftSavedGoal(savedGoal);
  }, [tripsGoal, savedGoal]);

  const commit = () => {
    onProfileSave({
      ...user.profile,
      weeklyTripsGoal: Math.max(Math.round(draftTripsGoal) || tripsGoal, 1),
      weeklySavedGoalGrams: Math.max(Math.round(draftSavedGoal) || savedGoal, 100),
    });
    setEditing(false);
  };

  const effectiveTripsGoal = editing ? draftTripsGoal : tripsGoal;
  const effectiveSavedGoal = editing ? draftSavedGoal : savedGoal;

  return (
    <section className="rounded-xl border border-border/70 bg-background/75 p-3" aria-label="Objectifs">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Target className="size-3.5 text-primary" aria-hidden="true" />
          Objectifs
        </span>
        {editing ? (
          <span className="flex gap-1">
            <Button type="button" size="sm" className="h-6 px-2 text-[11px]" onClick={commit}>
              <Check className="size-3" aria-hidden="true" />
              Valider
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </span>
        ) : (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={() => setEditing(true)}>
            Modifier
          </Button>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <div className="grid content-start gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Cette semaine</p>
          <GoalRow
            label="Trajets faits"
            value={summary.doneThisWeek}
            goal={effectiveTripsGoal}
            unit="trajets"
            editing={editing}
            onGoalChange={setDraftTripsGoal}
          />
          <GoalRow
            label="CO2 evite"
            value={summary.savedThisWeekGrams}
            goal={effectiveSavedGoal}
            unit="g"
            editing={editing}
            onGoalChange={setDraftSavedGoal}
          />
        </div>
        <div className="grid content-start gap-3 border-t border-border/60 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Ce mois-ci</p>
          <GoalRow
            label="Trajets faits"
            value={summary.doneThisMonth}
            goal={effectiveTripsGoal * 4}
            unit="trajets"
            editing={false}
            onGoalChange={() => undefined}
          />
          <GoalRow
            label="CO2 evite"
            value={summary.savedThisMonthGrams}
            goal={effectiveSavedGoal * 4}
            unit="g"
            editing={false}
            onGoalChange={() => undefined}
          />
        </div>
      </div>
      {editing ? (
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          L'objectif mensuel est derive de l'objectif hebdomadaire (x 4).
        </p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Hub central des trajets.

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

function UpcomingList({
  trips,
  onMarkDone,
  onCancelTrip,
  onDeleteTrip,
}: {
  trips: PlannedTrip[];
  onMarkDone: (trip: PlannedTrip) => void;
  onCancelTrip: (trip: PlannedTrip) => void;
  onDeleteTrip: (trip: PlannedTrip) => void;
}) {
  if (trips.length === 0) {
    return (
      <EmptyState
        icon={<CalendarClock className="size-4" aria-hidden="true" />}
        title="Aucun trajet a venir"
        hint="Calcule un itineraire puis « Planifier » pour le dater, ou cree un trajet recurrent pour tes deplacements reguliers."
      />
    );
  }

  return (
    <ul className="grid gap-2">
      {trips.map((trip) => (
        <li key={trip.id} className="grid gap-2 rounded-xl border border-border/70 bg-background p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-primary">
                <TripStatusDot status={trip.status} />
                {formatScheduleLabel(trip.scheduledFor)}
                {trip.recurringTripId ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold normal-case tracking-normal text-accent-foreground">
                    <Repeat className="size-2.5" aria-hidden="true" />
                    recurrent
                  </span>
                ) : null}
              </p>
              <h3 className="mt-0.5 truncate text-sm font-semibold">{trip.label}</h3>
              <OriginDestination origin={trip.origin.label} destination={trip.destination.label} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span className="font-mono text-[11px] text-muted-foreground">
                {trip.durationMinutes} min · {trip.distanceKm.toFixed(1)} km
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <Leaf className="size-3" aria-hidden="true" />-{trip.carbonSavedGrams} g CO2
              </span>
              <ModeIconRow trip={trip} />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" size="sm" className="h-7 px-2.5 text-[11px]" onClick={() => onMarkDone(trip)}>
              <Check className="size-3.5" aria-hidden="true" />
              Fait
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => onCancelTrip(trip)}
            >
              <X className="size-3.5" aria-hidden="true" />
              Annuler
            </Button>
            <span className="flex-1" aria-hidden="true" />
            <Button
              type="button"
              variant="ghost"
              size="compactIcon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onDeleteTrip(trip)}
              aria-label={`Supprimer ${trip.label}`}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RecurringList({
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
        hint="Automatise tes deplacements reguliers (ex: aller-retour au travail) : les occurrences se planifient toutes seules chaque semaine."
      />
    );
  }

  return (
    <ul className="grid gap-2">
      {trips.map((trip) => (
        <li
          key={trip.id}
          className={`grid gap-2.5 rounded-xl border p-3 transition ${
            trip.paused ? 'border-border/60 bg-muted/30 opacity-80' : 'border-border/70 bg-background'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 truncate text-sm font-semibold">
                {trip.label}
                {trip.paused ? (
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
            </div>
            <ModeIconRow trip={trip} />
          </div>
          <div className="flex items-center gap-1" aria-label="Jours actifs">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <span
                key={day}
                className={`grid h-6 w-7 place-items-center rounded-md text-[10px] font-bold ${
                  trip.daysOfWeek.includes(day)
                    ? trip.paused
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
              variant={trip.paused ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2.5 text-[11px]"
              onClick={() => onTogglePaused(trip)}
            >
              {trip.paused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
              {trip.paused ? 'Reprendre' : 'Mettre en pause'}
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
      ))}
    </ul>
  );
}

function HistoryList({ trips }: { trips: PlannedTrip[] }) {
  if (trips.length === 0) {
    return (
      <EmptyState
        icon={<Check className="size-4" aria-hidden="true" />}
        title="Aucun trajet fait pour le moment"
        hint="Marque un trajet planifie comme « Fait » : il alimente ici ton historique, tes stats et le suivi carbone."
      />
    );
  }

  return (
    <ul className="grid gap-2">
      {trips.map((trip) => (
        <li key={trip.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {formatScheduleLabel(trip.completedAt ?? trip.scheduledFor)}
            </p>
            <h3 className="truncate text-sm font-semibold">{trip.label}</h3>
            <OriginDestination origin={trip.origin.label} destination={trip.destination.label} />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Leaf className="size-3" aria-hidden="true" />-{trip.carbonSavedGrams} g
            </span>
            <span className="font-mono text-[11px] text-muted-foreground">{trip.distanceKm.toFixed(1)} km</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SavedList({
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
              {route.durationMinutes} min · {route.distanceKm.toFixed(1)} km · {route.carbonGrams} g
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

// ---------------------------------------------------------------------------
// Formulaire de planification (une fois / recurrent).

export interface PlanTripSubmit {
  kind: 'once' | 'recurring';
  scheduledFor?: Date;
  label: string;
  daysOfWeek?: number[];
  departureTime?: string;
  returnTime?: string | null;
}

export function PlanTripDialog({
  source,
  onOpenChange,
  onSubmit,
}: {
  source: TripSource | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (plan: PlanTripSubmit) => void;
}) {
  const [kind, setKind] = useState<'once' | 'recurring'>('once');
  const [label, setLabel] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [time, setTime] = useState('08:30');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [departureTime, setDepartureTime] = useState('08:30');
  const [roundTrip, setRoundTrip] = useState(true);
  const [returnTime, setReturnTime] = useState('18:00');

  useEffect(() => {
    if (!source) {
      return;
    }
    const next = new Date(Date.now() + 45 * 60_000);
    next.setMinutes(next.getMinutes() >= 30 ? 60 : 30, 0, 0);
    setKind('once');
    setLabel(source.label);
    setDate(next);
    setDatePickerOpen(false);
    setTime(toTimeInputValue(next));
  }, [source]);

  if (!source) {
    return null;
  }

  const toggleDay = (day: number) => {
    setDaysOfWeek((current) => {
      if (current.includes(day)) {
        return current.length === 1 ? current : current.filter((item) => item !== day);
      }
      return [...current, day];
    });
  };

  const submit = () => {
    const cleanLabel = label.trim() || source.label;
    if (kind === 'once') {
      if (!date) {
        setDatePickerOpen(true);
        return;
      }
      const [hours, minutes] = time.split(':').map(Number);
      onSubmit({
        kind,
        label: cleanLabel,
        scheduledFor: new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours ?? 8, minutes ?? 0),
      });
    } else {
      onSubmit({ kind, label: cleanLabel, daysOfWeek, departureTime, returnTime: roundTrip ? returnTime : null });
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Planifier ce trajet</DialogTitle>
          <DialogDescription>Une date precise, ou une routine qui se replanifie toute seule.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 px-5">
          <div className="rounded-xl border border-border/70 bg-muted/25 p-3">
            <h3 className="truncate text-sm font-semibold">{source.label}</h3>
            <OriginDestination origin={source.origin.label} destination={source.destination.label} />
            <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
              {source.durationMinutes} min · {source.distanceKm.toFixed(1)} km · -{source.carbonSavedGrams} g CO2
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Type de planification">
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'once'}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition ${
                kind === 'once' ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setKind('once')}
            >
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Une fois
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kind === 'recurring'}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition ${
                kind === 'recurring' ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setKind('recurring')}
            >
              <Repeat className="size-3.5" aria-hidden="true" />
              Recurrent
            </button>
          </div>

          <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-label">
            Nom du trajet
            <Input id="plan-label" value={label} onChange={(event) => setLabel(event.target.value)} className="h-9 text-sm" />
          </label>

          {kind === 'once' ? (
            <div className="grid grid-cols-[1.4fr_1fr] gap-2">
              <div className="grid gap-1.5 text-xs font-semibold">
                Date
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 justify-start px-3 text-sm font-medium capitalize">
                      <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {date ? FULL_DAY_FORMAT.format(date) : 'Choisir une date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto">
                    <Calendar
                      mode="single"
                      selected={date}
                      defaultMonth={date}
                      disabled={{ before: new Date() }}
                      onSelect={(selected) => {
                        if (selected) {
                          setDate(selected);
                          setDatePickerOpen(false);
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-time">
                Heure
                <Input id="plan-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-9 text-sm" />
              </label>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold">Jours de la semaine</span>
                <div className="flex gap-1" role="group" aria-label="Jours actifs">
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={daysOfWeek.includes(day)}
                      className={`h-8 flex-1 rounded-md text-[11px] font-bold transition ${
                        daysOfWeek.includes(day)
                          ? 'bg-primary text-primary-foreground shadow-soft'
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      }`}
                      onClick={() => toggleDay(day)}
                    >
                      {WEEKDAY_LABELS[day]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1.5 text-xs font-semibold" htmlFor="plan-departure">
                  Heure de depart
                  <Input
                    id="plan-departure"
                    type="time"
                    value={departureTime}
                    onChange={(event) => setDepartureTime(event.target.value)}
                    className="h-9 text-sm"
                  />
                </label>
                <label className={`grid gap-1.5 text-xs font-semibold ${roundTrip ? '' : 'opacity-45'}`} htmlFor="plan-return">
                  Heure du retour
                  <Input
                    id="plan-return"
                    type="time"
                    value={returnTime}
                    disabled={!roundTrip}
                    onChange={(event) => setReturnTime(event.target.value)}
                    className="h-9 text-sm"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={roundTrip}
                  onChange={(event) => setRoundTrip(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Aller-retour (le retour est planifie automatiquement)
              </label>
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="button" onClick={submit}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            {kind === 'once' ? 'Planifier' : 'Creer la routine'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Section laterale compacte (desktop) : le planificateur toujours a portee.

export function TripsSidebarSection({
  summary,
  upcoming,
  onMarkDone,
  onOpenHub,
}: {
  summary: TripActivitySummary;
  upcoming: PlannedTrip[];
  onMarkDone: (trip: PlannedTrip) => void;
  onOpenHub: (tab?: TripsHubTab) => void;
}) {
  return (
    <div className="grid gap-2 px-3 pb-4">
      {/* CTA principal de l'application : le planificateur. */}
      <button
        type="button"
        onClick={() => onOpenHub('upcoming')}
        className="group grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-primary p-3 text-left text-primary-foreground shadow-card transition hover:bg-primary/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--lime)] text-[var(--lime-foreground)] shadow-soft">
          <CalendarClock className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[15px] font-semibold leading-tight tracking-tight">Ouvrir le planificateur</span>
          <span className="block truncate text-[11px] font-medium text-primary-foreground/75">
            {summary.upcomingCount > 0
              ? `${summary.upcomingCount} trajet${summary.upcomingCount > 1 ? 's' : ''} a venir · ${summary.recurringActiveCount} routine${summary.recurringActiveCount > 1 ? 's' : ''} active${summary.recurringActiveCount > 1 ? 's' : ''}`
              : 'Dates, routines, objectifs et historique'}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-primary-foreground/70 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </button>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Fait / semaine" value={String(summary.doneThisWeek)} compact />
        <Metric label="CO2 evite" value={`${summary.savedThisWeekGrams} g`} compact />
      </div>

      {upcoming.length > 0 ? (
        <ul className="grid gap-1.5">
          {upcoming.slice(0, 3).map((trip) => (
            <li key={trip.id} className="flex items-center gap-2 rounded-lg border border-border/70 bg-background/75 py-1.5 pl-2.5 pr-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.05em] text-primary">
                  {formatScheduleLabel(trip.scheduledFor)}
                  {trip.recurringTripId ? ' · recurrent' : ''}
                </p>
                <p className="truncate text-xs font-semibold">{trip.label}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="compactIcon"
                className="h-7 w-7 shrink-0 text-primary"
                onClick={() => onMarkDone(trip)}
                aria-label={`Marquer fait : ${trip.label}`}
                title="Marquer fait"
              >
                <Check className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-background/60 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground">
          Aucun trajet planifie. Calcule un itineraire puis « Planifier ».
        </p>
      )}
    </div>
  );
}
