// Objectifs hebdomadaires de l'utilisateur et progression de la semaine.
import { useEffect, useState } from 'react';
import { Check, Target } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { MobilityProfile, SessionUser, TripActivitySummary } from '../../../types';

/** Objectifs par defaut, appliques aux profils anterieurs a cette fonctionnalite. */
export const DEFAULT_WEEKLY_TRIPS_GOAL = 5;
export const DEFAULT_WEEKLY_SAVED_GOAL_GRAMS = 2000;

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
