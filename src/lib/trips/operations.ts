// Operations sur les trajets programmes et les routines : des fonctions pures
// sur des listes. L'etat du compte est tenu en memoire par l'application et
// envoye en entier au serveur apres chaque action ; rien n'est stocke ici.
import type { PlannedTrip, PlannedTripStatus, RecurringTrip } from '../../types';

/** Minimisation : au-dela, les occurrences les plus anciennes sont ecartees. */
export const PLANNED_LIMIT = 400;

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

/**
 * Retire les occurrences encore "a faire" d'une routine (pause ou
 * suppression). Les occurrences faites ou annulees restent dans l'historique.
 */
export function pruneForRecurring(trips: PlannedTrip[], recurringId: string): PlannedTrip[] {
  return trips.filter((trip) => !(trip.recurringTripId === recurringId && trip.status === 'planned'));
}

export function upsertRecurring(trips: RecurringTrip[], trip: RecurringTrip): RecurringTrip[] {
  return [trip, ...trips.filter((item) => item.id !== trip.id)];
}

export function setRecurringPaused(trips: RecurringTrip[], tripId: string, paused: boolean): RecurringTrip[] {
  return trips.map((trip) => (trip.id === tripId ? { ...trip, paused } : trip));
}

export function removeRecurring(trips: RecurringTrip[], tripId: string): RecurringTrip[] {
  return trips.filter((trip) => trip.id !== tripId);
}
