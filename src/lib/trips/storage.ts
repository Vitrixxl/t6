// Persistance locale des trajets programmes et des routines.
//
// Chaque ecriture est appliquee au cache local puis empilee dans la file de
// synchronisation : l'interface reste instantanee, le serveur est rattrape
// ensuite.
import type { PlannedTrip, PlannedTripStatus, RecurringTrip } from '../../types';
import { enqueueOperation } from '../api/outbox';

const PLANNED_PREFIX = 'ufm.plannedTrips.';
const RECURRING_PREFIX = 'ufm.recurringTrips.';
const PLANNED_LIMIT = 400;

export function loadPlannedTrips(userId: string): PlannedTrip[] {
  return readArray<PlannedTrip>(plannedKey(userId));
}

export function loadRecurringTrips(userId: string): RecurringTrip[] {
  return readArray<RecurringTrip>(recurringKey(userId));
}

export function savePlannedTrip(trip: PlannedTrip): PlannedTrip[] {
  const trips = sortPlanned([trip, ...loadPlannedTrips(trip.userId).filter((item) => item.id !== trip.id)]);
  enqueuePlanned(trip);
  return persistPlanned(trip.userId, trips);
}

export function saveRecurringTrip(trip: RecurringTrip): RecurringTrip[] {
  const trips = [trip, ...loadRecurringTrips(trip.userId).filter((item) => item.id !== trip.id)];
  localStorage.setItem(recurringKey(trip.userId), JSON.stringify(trips));
  const { userId, ...payload } = trip;
  enqueueOperation(userId, { kind: 'recurring.upsert', trip: payload });
  return trips;
}

export function setPlannedTripStatus(
  userId: string,
  tripId: string,
  status: PlannedTripStatus,
  now: Date = new Date(),
): PlannedTrip[] {
  const trips = loadPlannedTrips(userId).map((trip) =>
    trip.id === tripId
      ? { ...trip, status, completedAt: status === 'done' ? now.toISOString() : null }
      : trip,
  );
  trips.filter((trip) => trip.id === tripId).forEach(enqueuePlanned);
  return persistPlanned(userId, trips);
}

export function deletePlannedTrip(userId: string, tripId: string): PlannedTrip[] {
  enqueueOperation(userId, { kind: 'planned.delete', tripId });
  return persistPlanned(userId, loadPlannedTrips(userId).filter((trip) => trip.id !== tripId));
}

export function setRecurringTripPaused(userId: string, tripId: string, paused: boolean): RecurringTrip[] {
  const trips = loadRecurringTrips(userId).map((trip) => (trip.id === tripId ? { ...trip, paused } : trip));
  localStorage.setItem(recurringKey(userId), JSON.stringify(trips));
  trips
    .filter((trip) => trip.id === tripId)
    .forEach(({ userId: owner, ...payload }) => enqueueOperation(owner, { kind: 'recurring.upsert', trip: payload }));
  return trips;
}

/**
 * Retire les occurrences encore "a faire" d'un trajet recurrent (pause ou
 * suppression). Les occurrences faites ou annulees restent dans l'historique.
 */
export function prunePlannedForRecurring(userId: string, recurringId: string): PlannedTrip[] {
  const remaining = loadPlannedTrips(userId).filter(
    (trip) => !(trip.recurringTripId === recurringId && trip.status === 'planned'),
  );
  const removed = loadPlannedTrips(userId).filter((trip) => !remaining.some((kept) => kept.id === trip.id));
  removed.forEach((trip) => enqueueOperation(userId, { kind: 'planned.delete', tripId: trip.id }));
  return persistPlanned(userId, remaining);
}

/** Supprime un trajet recurrent et ses occurrences encore "a faire". */
export function deleteRecurringTrip(userId: string, tripId: string): { recurring: RecurringTrip[]; planned: PlannedTrip[] } {
  const recurring = loadRecurringTrips(userId).filter((trip) => trip.id !== tripId);
  localStorage.setItem(recurringKey(userId), JSON.stringify(recurring));
  const planned = prunePlannedForRecurring(userId, tripId);
  // Cote serveur, la suppression de la routine emporte deja ses occurrences :
  // une seule operation suffit pour decrire l'intention.
  enqueueOperation(userId, { kind: 'recurring.delete', tripId });
  return { recurring, planned };
}

/**
 * Materialise les occurrences des trajets recurrents actifs sur la fenetre
 * glissante. Idempotent: une occurrence (recurrente, jour, sens) a un id
 * deterministe, donc une occurrence annulee ou faite n'est jamais regeneree.
 */

export function replacePlannedTrips(userId: string, trips: PlannedTrip[]): void {
  localStorage.setItem(plannedKey(userId), JSON.stringify(sortPlanned(trips)));
}

/** Remplace le cache local par l'etat du serveur (hydratation apres connexion). */
export function replaceRecurringTrips(userId: string, trips: RecurringTrip[]): void {
  localStorage.setItem(recurringKey(userId), JSON.stringify(trips));
}

export function enqueuePlanned(trip: PlannedTrip): void {
  const { userId, ...payload } = trip;
  enqueueOperation(userId, { kind: 'planned.upsert', trip: payload });
}

export function sortPlanned(trips: PlannedTrip[]): PlannedTrip[] {
  return trips.slice().sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

export function persistPlanned(userId: string, trips: PlannedTrip[]): PlannedTrip[] {
  // Au-dela de la limite, on ecarte d'abord les occurrences les plus anciennes.
  const bounded = trips.length > PLANNED_LIMIT ? sortPlanned(trips).slice(trips.length - PLANNED_LIMIT) : trips;
  localStorage.setItem(plannedKey(userId), JSON.stringify(bounded));
  return bounded;
}

export function readArray<T>(key: string): T[] {
  const payload = localStorage.getItem(key);
  if (!payload) {
    return [];
  }
  try {
    const parsed = JSON.parse(payload) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(key);
    return [];
  }
}

export function plannedKey(userId: string): string {
  return `${PLANNED_PREFIX}${userId}`;
}

export function recurringKey(userId: string): string {
  return `${RECURRING_PREFIX}${userId}`;
}
