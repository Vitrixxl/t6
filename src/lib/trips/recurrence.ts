// Regle de recurrence : materialisation des occurrences d'une routine.
//
// Les occurrences sont generees sur une fenetre glissante, assez large pour
// visualiser la semaine sans remplir le stockage indefiniment. L'identifiant
// d'une occurrence est deterministe (routine, jour, sens) : la generation est
// donc idempotente, et une occurrence deja faite ou annulee n'est jamais
// regeneree.
import type { PlannedTrip } from '../../types';
import { loadPlannedTrips, loadRecurringTrips, persistPlanned, sortPlanned, enqueuePlanned } from './storage';

// Les occurrences recurrentes sont materialisees sur une fenetre glissante.
export const RECURRING_HORIZON_DAYS = 7;

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

        // Une occurrence n'est materialisee que si son heure est encore devant.
        // Consultee le soir, une routine de semaine creait sinon les passages
        // de 08:30 et 18:00 du jour meme, que la tolerance de 24 h de
        // `upcomingTrips` comptait ensuite comme « a venir » (B18).
        //
        // La tolerance n'est pas touchee : elle sert a marquer « fait » en fin
        // de journee un trajet du matin qui, lui, a bien existe. Ce qui n'a
        // jamais existe n'a pas a naitre dans le passe.
        const scheduledFor = atTime(day, leg.time);
        if (scheduledFor.getTime() < now.getTime()) {
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
          scheduledFor: scheduledFor.toISOString(),
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

export function atTime(day: Date, time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

export function dayKey(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
}
