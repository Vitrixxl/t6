// Contrats des objets de mobilite : trajet realise, trajet programme, routine
// recurrente, itineraire sauvegarde.
//
// Chaque objet existe sous deux formes : tel que le serveur le rend, avec son
// proprietaire, et tel que le client l'envoie (`...Input`), sans lui.
import { z } from 'zod';
import {
  carbonGrams,
  carbonSavedGrams,
  distanceKm,
  durationMinutes,
  identifier,
  isoDate,
  journeyShape,
  label,
  modes,
  owned,
  tripShape,
} from './primitives';

export const tripRecord = z.object({
  id: identifier,
  ...owned,
  routeTitle: label,
  modes,
  distanceKm,
  durationMinutes,
  carbonGrams,
  carbonSavedGrams,
  createdAt: isoDate,
});
export const tripRecordInput = tripRecord.omit({ userId: true });
export type TripRecord = z.infer<typeof tripRecord>;

export const PLANNED_TRIP_STATUSES = ['planned', 'done', 'cancelled'] as const;
export const plannedTripStatus = z.enum(PLANNED_TRIP_STATUSES);
export type PlannedTripStatus = z.infer<typeof plannedTripStatus>;

export const plannedTrip = z.object({
  id: identifier,
  ...owned,
  ...tripShape,
  /** Date et heure prevues du depart (ISO). */
  scheduledFor: isoDate,
  status: plannedTripStatus,
  createdAt: isoDate,
  completedAt: isoDate.nullable(),
});
export const plannedTripInput = plannedTrip.omit({ userId: true });
export type PlannedTrip = z.infer<typeof plannedTrip>;

/**
 * Periode pendant laquelle une routine compte ses passages. `to` reste null
 * tant qu'elle court ; une mise en pause la clot, une reprise en ouvre une
 * nouvelle.
 */
export const routinePeriod = z.object({
  from: isoDate,
  to: isoDate.nullable(),
});
export type RoutinePeriod = z.infer<typeof routinePeriod>;

/** Heure "HH:MM". */
export const timeOfDay = z.string().regex(/^\d{2}:\d{2}$/, 'Heure au format HH:MM.');
/** Convention JS Date.getDay() : 0 = dimanche ... 6 = samedi. */
export const dayOfWeek = z.int().min(0).max(6);
export const daysOfWeek = z.array(dayOfWeek).min(1, 'Choisis au moins un jour.').max(7);

export const recurringTrip = z.object({
  id: identifier,
  ...owned,
  ...tripShape,
  daysOfWeek,
  departureTime: timeOfDay,
  /** Heure du retour pour un aller-retour, sinon null. */
  returnTime: timeOfDay.nullable(),
  // Une routine n'est jamais materialisee en trajets : ses passages sont
  // comptes a la lecture, sur ces periodes. Au moins une (la creation en
  // ouvre une) ; la borne haute garde l'etat fini, une pause et une reprise
  // n'ajoutant qu'une entree.
  periods: z.array(routinePeriod).min(1).max(100),
  createdAt: isoDate,
});
export const recurringTripInput = recurringTrip.omit({ userId: true });
export type RecurringTrip = z.infer<typeof recurringTrip>;

export const savedRoute = z.object({
  id: identifier,
  ...owned,
  routeId: identifier,
  routeTitle: label,
  ...journeyShape,
  score: z.number().min(-1000).max(1000),
  createdAt: isoDate,
});
export const savedRouteInput = savedRoute.omit({ userId: true });
export type SavedRouteRecord = z.infer<typeof savedRoute>;
