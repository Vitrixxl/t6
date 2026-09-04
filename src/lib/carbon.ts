import type { CarbonSummary, RecurringTrip, TripRecord } from '../types';
import { TRIP_HISTORY_LIMIT } from '../contracts/limits';
import { sumRoutines } from './trips/routines';
import { startOfWeek } from './week';

/**
 * Synthèse de la semaine en cours.
 *
 * L'historique conserve les cinquante derniers trajets, toutes semaines
 * confondues : les cumuler pour les comparer à un objectif hebdomadaire
 * revenait a remplir une barre de progression qui ne redescendait jamais le
 * lundi (B16). La fenêtre est donc appliquée ici, à la source, plutôt que
 * laissee à la charge de chaque écran.
 *
 * Les routines n'ecrivent rien dans l'historique : leurs passages déjà échus
 * de la semaine sont ajoutés ici, comme dans les objectifs, pour que les deux
 * écrans annoncent le même chiffre.
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
        records.reduce((sum, record) => sum + (record.carbonSavedGrams ?? 0), 0) + routines.carbonSavedGrams,
    );

    return {
        trips: records.length + routines.trips,
        totalDistanceKm,
        totalCarbonGrams,
        totalSavedGrams,
        goalUsagePercent: weeklyGoalGrams > 0 ? Math.min(Math.round((totalCarbonGrams / weeklyGoalGrams) * 100), 999) : 0,
    };
}

/** Ajoute un trajet realise en tete de l'historique, borne aux plus récents. */
export function recordTrip(records: TripRecord[], record: TripRecord): TripRecord[] {
    return [record, ...records.filter((item) => item.id !== record.id)].slice(0, TRIP_HISTORY_LIMIT);
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}
