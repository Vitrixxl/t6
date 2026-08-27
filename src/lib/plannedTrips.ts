// Planification des trajets : occurrences datees (a faire / fait / annule),
// trajets recurrents (ex: aller-retour domicile-travail) avec pause, et
// synthese d'activite pour les objectifs utilisateur.
import type {
  GeoPoint,
  MobilityMode,
  PlannedTrip,
  PlannedTripStatus,
  RecurringTrip,
  TripActivitySummary,
  TripRecord,
} from '../types';
import { enqueueOperation } from './api/outbox';

const PLANNED_PREFIX = 'ufm.plannedTrips.';
const RECURRING_PREFIX = 'ufm.recurringTrips.';
const PLANNED_LIMIT = 400;

// Les occurrences recurrentes sont materialisees sur une fenetre glissante:
// assez pour visualiser la semaine, sans remplir le stockage a l'infini.
export const RECURRING_HORIZON_DAYS = 7;

export const WEEKDAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Donnees minimales d'un trajet source (option calculee ou trajet enregistre). */
export interface TripSource {
  label: string;
  origin: GeoPoint;
  destination: GeoPoint;
  modes: MobilityMode[];
  distanceKm: number;
  durationMinutes: number;
  carbonGrams: number;
  carbonSavedGrams: number;
}

export function createPlannedTrip(
  userId: string,
  source: TripSource,
  scheduledFor: Date,
  now: Date = new Date(),
): PlannedTrip {
  return {
    id: crypto.randomUUID(),
    userId,
    label: source.label,
    origin: source.origin,
    destination: source.destination,
    modes: source.modes,
    distanceKm: source.distanceKm,
    durationMinutes: source.durationMinutes,
    carbonGrams: source.carbonGrams,
    carbonSavedGrams: source.carbonSavedGrams,
    scheduledFor: scheduledFor.toISOString(),
    status: 'planned',
    recurringTripId: null,
    createdAt: now.toISOString(),
    completedAt: null,
  };
}

export function createRecurringTrip(
  userId: string,
  source: TripSource,
  schedule: { daysOfWeek: number[]; departureTime: string; returnTime: string | null },
  now: Date = new Date(),
): RecurringTrip {
  return {
    id: crypto.randomUUID(),
    userId,
    label: source.label,
    origin: source.origin,
    destination: source.destination,
    modes: source.modes,
    distanceKm: source.distanceKm,
    durationMinutes: source.durationMinutes,
    carbonGrams: source.carbonGrams,
    carbonSavedGrams: source.carbonSavedGrams,
    daysOfWeek: [...schedule.daysOfWeek].sort((a, b) => a - b),
    departureTime: schedule.departureTime,
    returnTime: schedule.returnTime,
    paused: false,
    createdAt: now.toISOString(),
  };
}

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
export function syncRecurringOccurrences(userId: string, now: Date = new Date()): PlannedTrip[] {
  const recurring = loadRecurringTrips(userId);
  const planned = loadPlannedTrips(userId);
  const existingIds = new Set(planned.map((trip) => trip.id));
  const generated: PlannedTrip[] = [];

  for (const template of recurring) {
    if (template.paused || template.daysOfWeek.length === 0) {
      continue;
    }

    for (let offset = 0; offset < RECURRING_HORIZON_DAYS; offset += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      if (!template.daysOfWeek.includes(day.getDay())) {
        continue;
      }

      const legs: Array<{ direction: 'aller' | 'retour'; time: string | null }> = [
        { direction: 'aller', time: template.departureTime },
        { direction: 'retour', time: template.returnTime },
      ];

      for (const leg of legs) {
        if (!leg.time) {
          continue;
        }
        const id = occurrenceId(template.id, day, leg.direction);
        if (existingIds.has(id)) {
          continue;
        }
        const isReturn = leg.direction === 'retour';
        generated.push({
          id,
          userId,
          label: isReturn ? `${template.label} (retour)` : template.label,
          origin: isReturn ? template.destination : template.origin,
          destination: isReturn ? template.origin : template.destination,
          modes: template.modes,
          distanceKm: template.distanceKm,
          durationMinutes: template.durationMinutes,
          carbonGrams: template.carbonGrams,
          carbonSavedGrams: template.carbonSavedGrams,
          scheduledFor: atTime(day, leg.time).toISOString(),
          status: 'planned',
          recurringTripId: template.id,
          createdAt: now.toISOString(),
          completedAt: null,
        });
      }
    }
  }

  if (generated.length === 0) {
    return sortPlanned(planned);
  }
  // Les occurrences materialisees localement sont poussees au serveur : les
  // autres appareils du meme compte retrouvent la meme semaine planifiee.
  generated.forEach(enqueuePlanned);
  return persistPlanned(userId, sortPlanned([...planned, ...generated]));
}

export function occurrenceId(recurringId: string, day: Date, direction: 'aller' | 'retour'): string {
  return `rec:${recurringId}:${dayKey(day)}:${direction}`;
}

/** Occurrences encore a faire, de la plus proche a la plus lointaine. */
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

/** Lundi 00:00 de la semaine calendaire en cours. */
export function startOfWeek(now: Date): Date {
  const mondayOffset = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
}

export function summarizeTripActivity(
  planned: PlannedTrip[],
  recurring: RecurringTrip[],
  now: Date = new Date(),
): TripActivitySummary {
  const weekFloor = startOfWeek(now).getTime();
  const monthFloor = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const done = planned.filter((trip) => trip.status === 'done');
  const doneAt = (trip: PlannedTrip) => new Date(trip.completedAt ?? trip.scheduledFor).getTime();
  const doneThisWeek = done.filter((trip) => doneAt(trip) >= weekFloor);
  const doneThisMonth = done.filter((trip) => doneAt(trip) >= monthFloor);

  return {
    doneTotal: done.length,
    doneThisWeek: doneThisWeek.length,
    savedThisWeekGrams: Math.round(doneThisWeek.reduce((sum, trip) => sum + trip.carbonSavedGrams, 0)),
    doneThisMonth: doneThisMonth.length,
    savedThisMonthGrams: Math.round(doneThisMonth.reduce((sum, trip) => sum + trip.carbonSavedGrams, 0)),
    savedTotalGrams: Math.round(done.reduce((sum, trip) => sum + trip.carbonSavedGrams, 0)),
    distanceThisWeekKm: round(doneThisWeek.reduce((sum, trip) => sum + trip.distanceKm, 0), 1),
    upcomingCount: upcomingTrips(planned, now).length,
    recurringActiveCount: recurring.filter((trip) => !trip.paused).length,
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

/** Remplace le cache local par l'etat du serveur (hydratation apres connexion). */
export function replacePlannedTrips(userId: string, trips: PlannedTrip[]): void {
  localStorage.setItem(plannedKey(userId), JSON.stringify(sortPlanned(trips)));
}

/** Remplace le cache local par l'etat du serveur (hydratation apres connexion). */
export function replaceRecurringTrips(userId: string, trips: RecurringTrip[]): void {
  localStorage.setItem(recurringKey(userId), JSON.stringify(trips));
}

function enqueuePlanned(trip: PlannedTrip): void {
  const { userId, ...payload } = trip;
  enqueueOperation(userId, { kind: 'planned.upsert', trip: payload });
}

function sortPlanned(trips: PlannedTrip[]): PlannedTrip[] {
  return trips.slice().sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
}

function persistPlanned(userId: string, trips: PlannedTrip[]): PlannedTrip[] {
  // Au-dela de la limite, on ecarte d'abord les occurrences les plus anciennes.
  const bounded = trips.length > PLANNED_LIMIT ? sortPlanned(trips).slice(trips.length - PLANNED_LIMIT) : trips;
  localStorage.setItem(plannedKey(userId), JSON.stringify(bounded));
  return bounded;
}

function readArray<T>(key: string): T[] {
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

function atTime(day: Date, time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

function dayKey(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}

function plannedKey(userId: string): string {
  return `${PLANNED_PREFIX}${userId}`;
}

function recurringKey(userId: string): string {
  return `${RECURRING_PREFIX}${userId}`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
