// Vues de lecture : filtres et agrégats calculés à partir des trajets, sans
// aucun effet de bord ni accès au stockage.
//
// Les routines n'existent pas sous forme de trajets : leurs passages déjà
// échus sont ajoutés ici, au moment de compter (voir routines.ts).
import type { PlannedTrip, RecurringTrip, TripActivitySummary } from '../../types';
import { startOfWeek } from '../week';
import { BEGINNING_OF_TIME, isRoutinePaused, sumRoutines } from './routines';

export function upcomingTrips(trips: PlannedTrip[], now: Date = new Date()): PlannedTrip[] {
    return trips
        .filter((trip) => trip.status === 'planned' && new Date(trip.scheduledFor).getTime() >= now.getTime())
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export function summarizeTripActivity(
    planned: PlannedTrip[],
    recurring: RecurringTrip[],
    now: Date = new Date(),
): TripActivitySummary {
    const weekFloor = startOfWeek(now);
    const monthFloor = new Date(now.getFullYear(), now.getMonth(), 1);
    const done = planned.filter((trip) => trip.status === 'done');
    const doneAt = (trip: PlannedTrip) => new Date(trip.completedAt ?? trip.scheduledFor).getTime();
    const doneThisWeek = done.filter((trip) => doneAt(trip) >= weekFloor.getTime());
    const doneThisMonth = done.filter((trip) => doneAt(trip) >= monthFloor.getTime());

    const routinesTotal = sumRoutines(recurring, BEGINNING_OF_TIME, now);
    const routinesThisWeek = sumRoutines(recurring, weekFloor, now);
    const routinesThisMonth = sumRoutines(recurring, monthFloor, now);
    const saved = (trips: PlannedTrip[]) => trips.reduce((sum, trip) => sum + (trip.carbonSavedGrams ?? 0), 0);

    return {
        doneTotal: done.length + routinesTotal.trips,
        doneThisWeek: doneThisWeek.length + routinesThisWeek.trips,
        savedThisWeekGrams: Math.round(saved(doneThisWeek) + routinesThisWeek.carbonSavedGrams),
        doneThisMonth: doneThisMonth.length + routinesThisMonth.trips,
        savedThisMonthGrams: Math.round(saved(doneThisMonth) + routinesThisMonth.carbonSavedGrams),
        savedTotalGrams: Math.round(saved(done) + routinesTotal.carbonSavedGrams),
        distanceThisWeekKm: round(
            doneThisWeek.reduce((sum, trip) => sum + trip.distanceKm, 0) + routinesThisWeek.distanceKm,
            1,
        ),
        upcomingCount: upcomingTrips(planned, now).length,
        recurringActiveCount: recurring.filter((trip) => !isRoutinePaused(trip)).length,
    };
}

function round(value: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}
