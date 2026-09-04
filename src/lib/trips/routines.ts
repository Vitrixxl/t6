// Routines : une habitude déclarée, jamais matérialisée.
//
// Les passages échus sont calculés dans le fuseau de la routine, sur ses
// périodes d’activité. Les exceptions datées retirent uniquement les sens
// annulés ; aucun trajet ponctuel n’est créé pour représenter une occurrence.
import { atCalendarTime, calendarDate, nextCalendarDate } from './calendar';
import type { TripDirection } from '../../contracts';
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
    const lastDay = calendarDate(to, routine.timeZone);
    for (let day = calendarDate(from, routine.timeZone); day <= lastDay; day = nextCalendarDate(day)) {
        if (!routine.daysOfWeek.includes(new Date(`${day}T12:00:00Z`).getUTCDay())) {
            continue;
        }
        for (const time of times) {
            const at = atCalendarTime(day, time, routine.timeZone);
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
    return routinePassagesBetween(routine, floor, now)
        .filter((passage) => !isPassageCancelled(routine, passage)).length;
}

/** Prochain passage d'une routine active, ou null si elle est en pause ou sans jour actif. */
export function nextOccurrence(routine: RecurringTrip, now: Date = new Date()): Date | null {
    if (isRoutinePaused(routine)) {
        return null;
    }
    // Huit jours : une routine qui a au moins un jour actif tombe forcement dedans.
    const horizon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 8);
    return routinePassagesBetween(routine, now, horizon)
        .find((passage) => !isPassageCancelled(routine, passage))?.at ?? null;
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

function latest(a: Date, b: Date): Date {
    return a.getTime() >= b.getTime() ? a : b;
}

function earliest(a: Date, b: Date): Date {
    return a.getTime() <= b.getTime() ? a : b;
}

/** Passages effectifs du calendrier, y compris ceux annulés, pour l’historique. */
export function activeOccurrencesBetween(routine: RecurringTrip, floor: Date, until: Date): Date[] {
    const occurrences = routine.periods.flatMap((period) => {
        const from = latest(latest(new Date(period.from), new Date(routine.createdAt)), floor);
        const to = period.to ? earliest(new Date(period.to), until) : until;
        return occurrencesBetween(routine, from, to);
    });
    return [...new Set(occurrences.map((at) => at.getTime()))].sort((a, b) => a - b).map((at) => new Date(at));
}

export interface RoutinePassage {
    at: Date;
    direction: TripDirection;
}

/** Le sens fait partie de l’identité : deux passages à la même heure restent distincts. */
export function routinePassagesBetween(routine: RecurringTrip, from: Date, to: Date): RoutinePassage[] {
    const outbound = activeOccurrencesBetween({ ...routine, returnTime: null }, from, to)
        .map((at): RoutinePassage => ({ at, direction: 'outbound' }));
    const returning = routine.returnTime
        ? activeOccurrencesBetween({ ...routine, departureTime: routine.returnTime, returnTime: null }, from, to)
            .map((at): RoutinePassage => ({ at, direction: 'return' }))
        : [];
    return [...outbound, ...returning].sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function isPassageCancelled(routine: RecurringTrip, passage: RoutinePassage): boolean {
    const date = calendarDate(passage.at, routine.timeZone);
    return routine.cancelledPassages.some((item) => item.date === date && item.direction === passage.direction);
}
