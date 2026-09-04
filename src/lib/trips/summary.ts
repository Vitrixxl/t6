// Vues de lecture : filtres et agregats calcules a partir des trajets, sans
// aucun effet de bord ni acces au stockage.
//
// Les routines n'existent pas sous forme de trajets : leurs passages deja
// echus sont ajoutes ici, au moment de compter (voir routines.ts).
import type { PlannedTrip, RecurringTrip, TripActivitySummary, TripRecord } from '../../types';
import { startOfWeek } from '../week';
import { BEGINNING_OF_TIME, isRoutinePaused, sumRoutines } from './routines';

export function upcomingTrips(trips: PlannedTrip[], now: Date = new Date(), graceHours = 24): PlannedTrip[] {
  const floor = now.getTime() - graceHours * 3_600_000;
  return trips
    .filter((trip) => trip.status === 'planned' && new Date(trip.scheduledFor).getTime() >= floor)
    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

/** Trajets faits, du plus recent au plus ancien. */
export function completedTrips(trips: PlannedTrip[]): PlannedTrip[] {
  return trips
    .filter((trip) => trip.status === 'done')
    .sort((a, b) => (b.completedAt ?? b.scheduledFor).localeCompare(a.completedAt ?? a.scheduledFor));
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

/** Convertit un trajet fait en enregistrement carbone (meme forme que TripRecord). */
export function plannedTripToRecord(trip: PlannedTrip, now: Date = new Date()): TripRecord {
  return {
    id: `trip:${trip.id}`,
    userId: trip.userId,
    routeTitle: trip.label,
    modes: trip.modes,
    distanceKm: trip.distanceKm,
    durationMinutes: trip.durationMinutes,
    carbonGrams: trip.carbonGrams,
    carbonSavedGrams: trip.carbonSavedGrams,
    createdAt: (trip.completedAt ?? now.toISOString()),
  };
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
