// Operations pures sur les vues locales des trajets programmes et routines.
// Elles projettent immediatement une commande granulaire dans le cache ; elles
// ne definissent ni requete HTTP ni stockage.
import type { PlannedTrip, PlannedTripStatus, RecurringTrip } from '../../types';
import { PLANNED_LIMIT } from '../../contracts/limits';
import { isRoutinePaused } from './routines';

export function sortPlanned(trips: PlannedTrip[]): PlannedTrip[] {
  return trips.slice().sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

/** Trie et borne : la forme sous laquelle la liste est toujours rendue. */
export function boundPlanned(trips: PlannedTrip[]): PlannedTrip[] {
  const sorted = sortPlanned(trips);
  return sorted.length > PLANNED_LIMIT ? sorted.slice(sorted.length - PLANNED_LIMIT) : sorted;
}

export function upsertPlanned(trips: PlannedTrip[], trip: PlannedTrip): PlannedTrip[] {
  return boundPlanned([trip, ...trips.filter((item) => item.id !== trip.id)]);
}

export function setPlannedStatus(
  trips: PlannedTrip[],
  tripId: string,
  status: PlannedTripStatus,
  now: Date = new Date(),
): PlannedTrip[] {
  return boundPlanned(
    trips.map((trip) =>
      trip.id === tripId ? { ...trip, status, completedAt: status === 'done' ? now.toISOString() : null } : trip,
    ),
  );
}

export function removePlanned(trips: PlannedTrip[], tripId: string): PlannedTrip[] {
  return trips.filter((trip) => trip.id !== tripId);
}

export function upsertRecurring(trips: RecurringTrip[], trip: RecurringTrip): RecurringTrip[] {
  return [trip, ...trips.filter((item) => item.id !== trip.id)];
}

/**
 * Pause : la periode d'activite courante se clot, les passages suivants ne
 * comptent plus. Reprise : une nouvelle periode s'ouvre, et les passages
 * tombes pendant la pause restent hors compte. Sans effet si la routine est
 * deja dans l'etat demande.
 */
export function setRecurringPaused(
  trips: RecurringTrip[],
  tripId: string,
  paused: boolean,
  now: Date = new Date(),
): RecurringTrip[] {
  const at = now.toISOString();
  return trips.map((trip) => {
    if (trip.id !== tripId || isRoutinePaused(trip) === paused) {
      return trip;
    }
    const periods = paused
      ? trip.periods.map((period, index) => (index === trip.periods.length - 1 ? { ...period, to: at } : period))
      : [...trip.periods, { from: at, to: null }];
    return { ...trip, periods };
  });
}

export function removeRecurring(trips: RecurringTrip[], tripId: string): RecurringTrip[] {
  return trips.filter((trip) => trip.id !== tripId);
}
