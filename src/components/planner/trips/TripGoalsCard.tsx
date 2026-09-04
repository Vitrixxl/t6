// Objectifs hebdomadaires de l'utilisateur et progression de la semaine.
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { Check, Target } from 'lucide-react';
import { z } from 'zod';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { mobilityProfile } from '../../../contracts';
import { useActivitySummary, useProfile, useUpdateProfile } from '../../../queries';

/** Objectifs par defaut, appliques aux profils anterieurs a cette fonctionnalite. */
export const DEFAULT_WEEKLY_TRIPS_GOAL = 5;
export const DEFAULT_WEEKLY_SAVED_GOAL_GRAMS = 2000;

// Les objectifs sont deux champs du profil : le formulaire en reprend le
// contrat, bornes comprises, et le profil repart entier avec eux.
const goalsForm = mobilityProfile.pick({ weeklyTripsGoal: true, weeklySavedGoalGrams: true }).required();
type GoalsFormValues = z.infer<typeof goalsForm>;

function GoalRow({
  label,
  value,
  goal,
  unit,
  field,
  error,
}: {
  label: string;
  value: number;
  goal: number;
  unit: string;
  /** Champ de saisie, quand la ligne est en edition. */
  field?: UseFormRegisterReturn;
  error?: string;
}) {
  const percent = goal > 0 ? Math.min(Math.round((value / goal) * 100), 100) : 0;
  const reached = goal > 0 && value >= goal;
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        {field ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
            {value} /
            <Input type="number" min={1} className="h-7 w-20 px-2 text-right text-xs" aria-label={`Objectif ${label}`} {...field} />
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
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function TripGoalsCard() {
  const profile = useProfile();
  const summary = useActivitySummary();
  const updateProfile = useUpdateProfile();
  const tripsGoal = profile.weeklyTripsGoal ?? DEFAULT_WEEKLY_TRIPS_GOAL;
  const savedGoal = profile.weeklySavedGoalGrams ?? DEFAULT_WEEKLY_SAVED_GOAL_GRAMS;
  const [editing, setEditing] = useState(false);
  const form = useForm<GoalsFormValues>({
    resolver: zodResolver(goalsForm),
    values: { weeklyTripsGoal: tripsGoal, weeklySavedGoalGrams: savedGoal },
  });
  const { errors } = form.formState;
  const draft = form.watch();

  const commit = form.handleSubmit((values) => {
    updateProfile({ ...profile, ...values });
    setEditing(false);
  });

  const cancel = () => {
    form.reset();
    setEditing(false);
  };

  const effectiveTripsGoal = editing ? draft.weeklyTripsGoal : tripsGoal;
  const effectiveSavedGoal = editing ? draft.weeklySavedGoalGrams : savedGoal;

  return (
    <form className="rounded-xl border border-border/70 bg-background/75 p-3" aria-label="Objectifs" noValidate onSubmit={commit}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Target className="size-3.5 text-primary" aria-hidden="true" />
          Objectifs
        </span>
        {editing ? (
          <span className="flex gap-1">
            <Button type="submit" size="sm" className="h-6 px-2 text-[11px]">
              <Check className="size-3" aria-hidden="true" />
              Valider
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={cancel}>
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
            field={editing ? form.register('weeklyTripsGoal', { valueAsNumber: true }) : undefined}
            error={errors.weeklyTripsGoal?.message}
          />
          <GoalRow
            label="CO2 evite"
            value={summary.savedThisWeekGrams}
            goal={effectiveSavedGoal}
            unit="g"
            field={editing ? form.register('weeklySavedGoalGrams', { valueAsNumber: true }) : undefined}
            error={errors.weeklySavedGoalGrams?.message}
          />
        </div>
        <div className="grid content-start gap-3 border-t border-border/60 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Ce mois-ci</p>
          <GoalRow label="Trajets faits" value={summary.doneThisMonth} goal={effectiveTripsGoal * 4} unit="trajets" />
          <GoalRow label="CO2 evite" value={summary.savedThisMonthGrams} goal={effectiveSavedGoal * 4} unit="g" />
        </div>
      </div>
      {editing ? (
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
          L'objectif mensuel est derive de l'objectif hebdomadaire (x 4).
        </p>
      ) : null}
    </form>
  );
}
