import type { CarbonSummary, RecurringTrip, TripRecord } from '../types';
import { sumRoutines } from './trips/routines';
import { startOfWeek } from './week';

/** Minimisation : l'historique ne garde que les trajets les plus recents. */
export const TRIP_HISTORY_LIMIT = 50;

/**
 * Synthese de la semaine en cours.
 *
 * L'historique conserve les cinquante derniers trajets, toutes semaines
 * confondues : les cumuler pour les comparer a un objectif hebdomadaire
 * revenait a remplir une barre de progression qui ne redescendait jamais le
 * lundi (B16). La fenetre est donc appliquee ici, a la source, plutot que
 * laissee a la charge de chaque ecran.
 *
 * Les routines n'ecrivent rien dans l'historique : leurs passages deja echus
 * de la semaine sont ajoutes ici, comme dans les objectifs, pour que les deux
 * ecrans annoncent le meme chiffre.
 */
export function summarizeCarbon(
  allRecords: TripRecord[],
  recurring: RecurringTrip[],
  weeklyGoalGrams: number,
  now: Date = new Date(),
): CarbonSummary {
  const weekFloor = startOfWeek(now);
  const records = allRecords.filter((record) => new Date(record.createdAt).getTime() >= weekFloor.getTime());
  const routines = sumRoutines(recurring, weekFloor, now);
  const totalDistanceKm = round(records.reduce((sum, record) => sum + record.distanceKm, 0) + routines.distanceKm, 2);
  const totalCarbonGrams = Math.round(records.reduce((sum, record) => sum + record.carbonGrams, 0) + routines.carbonGrams);
  const totalSavedGrams = Math.round(
    records.reduce((sum, record) => sum + record.carbonSavedGrams, 0) + routines.carbonSavedGrams,
  );

  return {
    trips: records.length + routines.trips,
    totalDistanceKm,
    totalCarbonGrams,
    totalSavedGrams,
    goalUsagePercent: weeklyGoalGrams > 0 ? Math.min(Math.round((totalCarbonGrams / weeklyGoalGrams) * 100), 999) : 0,
  };
}

/** Ajoute un trajet realise en tete de l'historique, borne aux plus recents. */
export function recordTrip(records: TripRecord[], record: TripRecord): TripRecord[] {
  return [record, ...records.filter((item) => item.id !== record.id)].slice(0, TRIP_HISTORY_LIMIT);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
