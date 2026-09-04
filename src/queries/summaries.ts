// Syntheses dérivées de plusieurs parties du compte. Les routines n'ecrivent
// rien dans l'historique : leurs passages échus sont ajoutés au moment de
// compter, par les mêmes fonctions pour les objectifs et le suivi carbone,
// donc les deux écrans annoncent le même chiffre.
import { useNow } from '../state/clock';
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
    const now = useNow();
    return useMemo(() => summarizeTripActivity(planned, recurring, now), [planned, recurring, now]);
}

export function useCarbonSummary(): CarbonSummary {
    const records = useTripRecords();
    const recurring = useRecurringTrips();
    const goal = useProfile().carbonGoalGramsPerWeek;
    const now = useNow();
    return useMemo(() => summarizeCarbon(records, recurring, goal, now), [goal, records, recurring, now]);
}
