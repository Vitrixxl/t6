// Routines : une habitude déclarée, jamais matérialisée.
//
// Une routine dit « ces jours-la, a cette heure, je fais ce trajet ». Rien
// n'est génère à l'avance : au moment de compter les trajets faits ou le CO2
// évite, on regarde simplement combien de passages sont déjà tombes dans ses
// périodes d'activite. Pas d'occurrence a créér, a dedoublonner ni a purger ;
// un compteur se recalcule, il ne peut pas se désynchroniser.
import type { RecurringTrip } from '../../types';

/** Une routine est en pause quand sa derniere période d'activite est close. */
export function isRoutinePaused(routine: RecurringTrip): boolean {
    const last = routine.periods[routine.periods.length - 1];
    return !last || last.to !== null;
}

/** Heures de passage (aller, puis retour) de la routine dans [from, to), par ordre chronologique. */
export function occurrencesBetween(routine: RecurringTrip, from: Date, to: Date): Date[] {
    const occurrences: Date[] = [];
    if (routine.daysOfWeek.length === 0 || from.getTime() >= to.getTime()) {
        return occurrences;
    }
    const times = routine.returnTime ? [routine.departureTime, routine.returnTime].sort() : [routine.departureTime];
    for (let day = startOfDay(from); day.getTime() < to.getTime(); day = nextDay(day)) {
        if (!routine.daysOfWeek.includes(day.getDay())) {
            continue;
        }
        for (const time of times) {
            const at = atTime(day, time);
            if (at.getTime() >= from.getTime() && at.getTime() < to.getTime()) {
                occurrences.push(at);
            }
        }
    }
    return occurrences;
}

/**
 * Passages déjà échus, tombes dans les périodes d'activite et pas avant
 * `floor`. Un passage dont l'heure n'est pas encore passée ne compte pas :
 * ce qui n'a pas encore pu être fait n'est pas fait.
 */
export function countOccurrences(routine: RecurringTrip, floor: Date, now: Date): number {
    let count = 0;
    for (const period of routine.periods) {
        const from = latest(new Date(period.from), floor);
        const to = period.to ? earliest(new Date(period.to), now) : now;
        count += occurrencesBetween(routine, from, to).length;
    }
    return count;
}

/** Prochain passage d'une routine active, ou null si elle est en pause ou sans jour actif. */
export function nextOccurrence(routine: RecurringTrip, now: Date = new Date()): Date | null {
    if (isRoutinePaused(routine)) {
        return null;
    }
    // Huit jours : une routine qui a au moins un jour actif tombe forcement dedans.
    const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
    return occurrencesBetween(routine, now, horizon)[0] ?? null;
}

/** Ce que les routines apportent aux compteurs depuis `floor` : passages et mesures cumulees. */
export interface RoutineTotals {
    trips: number;
    distanceKm: number;
    carbonGrams: number;
    carbonSavedGrams: number;
}

export function sumRoutines(routines: RecurringTrip[], floor: Date, now: Date): RoutineTotals {
    const totals: RoutineTotals = { trips: 0, distanceKm: 0, carbonGrams: 0, carbonSavedGrams: 0 };
    for (const routine of routines) {
        const count = countOccurrences(routine, floor, now);
        totals.trips += count;
        totals.distanceKm += count * routine.distanceKm;
        totals.carbonGrams += count * routine.carbonGrams;
        // Une comparaison absente ne vaut pas zéro dans le trajet. Elle est
        // simplement exclue de l'agregat des seules économies mesurées.
        totals.carbonSavedGrams += count * (routine.carbonSavedGrams ?? 0);
    }
    return totals;
}

/** Plancher pour « depuis toujours » : avant toute date de création possible. */
export const BEGINNING_OF_TIME = new Date(0);

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function nextDay(day: Date): Date {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
}

function atTime(day: Date, time: string): Date {
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

function latest(a: Date, b: Date): Date {
    return a.getTime() >= b.getTime() ? a : b;
}

function earliest(a: Date, b: Date): Date {
    return a.getTime() <= b.getTime() ? a : b;
}
