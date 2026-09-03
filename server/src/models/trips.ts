// Contrats des objets de mobilite : trajet realise, trajet programme, routine
// recurrente, itineraire sauvegarde.
import { t } from 'elysia';
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
} from './primitives.ts';

export const tripRecord = t.Object({
  id: identifier,
  routeTitle: label,
  modes,
  distanceKm,
  durationMinutes,
  carbonGrams,
  carbonSavedGrams,
  createdAt: isoDate,
});

export const plannedTrip = t.Object({
  id: identifier,
  ...tripShape,
  scheduledFor: isoDate,
  status: t.Union([t.Literal('planned'), t.Literal('done'), t.Literal('cancelled')]),
  createdAt: isoDate,
  completedAt: t.Nullable(isoDate),
});

/** Periode d'activite d'une routine ; `to` est null tant qu'elle court. */
const routinePeriod = t.Object({
  from: isoDate,
  to: t.Nullable(isoDate),
});

export const recurringTrip = t.Object({
  id: identifier,
  ...tripShape,
  /** Convention JS Date.getDay() : 0 = dimanche ... 6 = samedi. */
  daysOfWeek: t.Array(t.Integer({ minimum: 0, maximum: 6 }), { maxItems: 7 }),
  departureTime: t.String({ pattern: '^\\d{2}:\\d{2}$' }),
  returnTime: t.Nullable(t.String({ pattern: '^\\d{2}:\\d{2}$' })),
  // Au moins une periode (la creation en ouvre une) ; la borne haute garde
  // l'etat fini, une pause et une reprise n'ajoutant qu'une entree.
  periods: t.Array(routinePeriod, { minItems: 1, maxItems: 100 }),
  createdAt: isoDate,
});

export const savedRoute = t.Object({
  id: identifier,
  routeId: identifier,
  routeTitle: label,
  ...journeyShape,
  score: t.Number({ minimum: -1000, maximum: 1000 }),
  createdAt: isoDate,
});

// Versions renvoyees au client : les memes objets, augmentes de leur
// proprietaire. Elles sont ecrites a plat plutot qu'en intersection de schemas
// : le validateur de reponse d'Elysia les verifie de facon fiable, et la
// documentation OpenAPI reste lisible.
export const ownedTripRecord = t.Object({ ...tripRecord.properties, ...owned });
export const ownedPlannedTrip = t.Object({ ...plannedTrip.properties, ...owned });
export const ownedRecurringTrip = t.Object({ ...recurringTrip.properties, ...owned });
export const ownedSavedRoute = t.Object({ ...savedRoute.properties, ...owned });
