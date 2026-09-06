// Contrats des objets de mobilité : trajet realise, trajet programmé, routine
// récurrente, itinéraire sauvegarde.
//
// Chaque objet existe sous deux formes : tel que le serveur le rend, avec son
// identifiant et son proprietaire, et tel que le client l'envoie au PUT de la
// ressource (`...Input`), sans les deux valeurs portées par l'URL/la session.
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
export type TripRecord = z.infer<typeof tripRecord>;

export const PLANNED_TRIP_STATUSES = ['planned', 'done', 'cancelled'] as const;
export const plannedTripStatus = z.enum(PLANNED_TRIP_STATUSES);
export type PlannedTripStatus = z.infer<typeof plannedTripStatus>;

export const plannedTrip = z.object({
    id: identifier,
    ...owned,
    ...tripShape,
    /** Date et heure prévues du départ (ISO). */
    scheduledFor: isoDate,
    status: plannedTripStatus,
    createdAt: isoDate,
    completedAt: isoDate.nullable(),
});
export const plannedTripInput = plannedTrip.omit({ id: true, userId: true }).extend({
    // Le serveur détermine `done` automatiquement à partir de la date prévue.
    status: z.enum(['planned', 'cancelled']),
    completedAt: z.null(),
});
export type PlannedTrip = z.infer<typeof plannedTrip>;

/**
 * Période pendant laquelle une routine compte ses passages. `to` reste null
 * tant qu'elle court ; une mise en pause la clôt, une reprise en ouvre une
 * nouvelle.
 */
export const routinePeriod = z.object({
    from: isoDate,
    to: isoDate.nullable(),
});
export type RoutinePeriod = z.infer<typeof routinePeriod>;

/** Heure "HH:MM". */
export const timeOfDay = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Heure au format HH:MM.');
/** Convention JS Date.getDay() : 0 = dimanche ... 6 = samedi. */
export const dayOfWeek = z.int().min(0).max(6);
export const daysOfWeek = z.array(dayOfWeek).min(1, 'Choisis au moins un jour.').max(7);

export const tripDirection = z.enum(['outbound', 'return']);
export type TripDirection = z.infer<typeof tripDirection>;
export const cancelledPassage = z.object({ date: z.iso.date(), direction: tripDirection });
export type CancelledPassage = z.infer<typeof cancelledPassage>;
export const recurringCancellationInput = z.object({ directions: z.array(tripDirection).min(1).max(2) });

const routineTimeZone = z.string().max(100).refine((value) => {
    try {
        new Intl.DateTimeFormat('fr-FR', { timeZone: value });
        return true;
    } catch {
        return false;
    }
}, 'Fuseau horaire inconnu.').default('Europe/Paris');

export const recurringTrip = z.object({
    id: identifier,
    ...owned,
    ...tripShape,
    daysOfWeek,
    timeZone: routineTimeZone,
    departureTime: timeOfDay,
    /** Heure du retour pour un aller-retour, sinon null. */
    returnTime: timeOfDay.nullable(),
    // Une routine n'est jamais matérialisée en trajets : ses passages sont
    // comptes à la lecture, sur ces périodes. Au moins une (la création en
    // ouvre une) ; la borne haute garde l'état fini, une pause et une reprise
    // n'ajoutant qu'une entrée.
    periods: z.array(routinePeriod).min(1).max(100),
    /** Exceptions datées : seuls les sens annulés sont exclus des calculs. */
    cancelledPassages: z.array(cancelledPassage).default([]),
    createdAt: isoDate,
});
export const recurringTripInput = recurringTrip.omit({ id: true, userId: true, cancelledPassages: true });
export type RecurringTrip = z.infer<typeof recurringTrip>;

export const savedRoute = z.object({
    id: identifier,
    ...owned,
    routeId: identifier,
    routeTitle: label,
    ...journeyShape,
    createdAt: isoDate,
});
export const savedRouteInput = savedRoute.omit({ id: true, userId: true });
export type SavedRouteRecord = z.infer<typeof savedRoute>;

/** Identifiant d'une ressource appartenant au compte courant. */
export const resourceIdParams = z.object({ id: identifier });

/** Une annulation désigne une journée de la routine, jamais sa collection d’exceptions. */
export const recurringCancellationParams = resourceIdParams.extend({ date: z.iso.date() });
export const recurringRestorationParams = recurringCancellationParams.extend({ direction: tripDirection });
