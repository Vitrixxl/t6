// Syntheses derivees de plusieurs parties du compte. Les routines n'ecrivent
// rien dans l'historique : leurs passages echus sont ajoutes au moment de
// compter, par les memes fonctions pour les objectifs et le suivi carbone,
// donc les deux ecrans annoncent le meme chiffre.
import { useMemo } from 'react';
import type { CarbonSummary, TripActivitySummary } from '../types';
import { summarizeCarbon } from '../lib/carbon';
import { summarizeTripActivity } from '../lib/trips';
import { usePlannedTrips } from './planned-trips';
import { useProfile } from './profile';
import { useRecurringTrips } from './recurring-trips';
import { useTripRecords } from './trip-records';

export function useActivitySummary(): TripActivitySummary {
  const planned = usePlannedTrips();
  const recurring = useRecurringTrips();
  return useMemo(() => summarizeTripActivity(planned, recurring), [planned, recurring]);
}

export function useCarbonSummary(): CarbonSummary {
  const records = useTripRecords();
  const recurring = useRecurringTrips();
  const goal = useProfile().carbonGoalGramsPerWeek;
  return useMemo(() => summarizeCarbon(records, recurring, goal), [goal, records, recurring]);
}
