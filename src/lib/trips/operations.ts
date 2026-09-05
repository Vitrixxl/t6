// Opérations pures sur les vues locales des trajets programmés et routines.
// Les réponses du serveur actualisent les collections du cache. La pause prépare
// une seule ressource à envoyer ; aucune fonction ici ne stocke ni ne fait de HTTP.
import type { PlannedTrip, RecurringTrip } from '../../types';
import { PLANNED_LIMIT } from '../../contracts/limits';
import { isRoutinePaused } from './routines';

export function upsertPlanned(trips: PlannedTrip[], trip: PlannedTrip): PlannedTrip[] {
    return [trip, ...trips.filter((item) => item.id !== trip.id)]
        .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
        .slice(-PLANNED_LIMIT);
}

export function removePlanned(trips: PlannedTrip[], tripId: string): PlannedTrip[] {
    return trips.filter((trip) => trip.id !== tripId);
}

export function upsertRecurring(trips: RecurringTrip[], trip: RecurringTrip): RecurringTrip[] {
    return [trip, ...trips.filter((item) => item.id !== trip.id)];
}

/**
 * Pause : la période d’activité courante se clôt, les passages suivants ne
 * comptent plus. Reprise : une nouvelle période s'ouvre, et les passages
 * tombés pendant la pause restent hors compte. Sans effet si la routine est
 * déjà dans l'état demandé.
 */
export function setRecurringPaused(
    trip: RecurringTrip,
    paused: boolean,
    now: Date = new Date(),
): RecurringTrip {
    if (isRoutinePaused(trip) === paused) {
        return trip;
    }
    const at = now.toISOString();
    const periods = paused
        ? trip.periods.map((period, index) => index === trip.periods.length - 1 ? { ...period, to: at } : period)
        : [...trip.periods, { from: at, to: null }];
    return { ...trip, periods };
}

export function removeRecurring(trips: RecurringTrip[], tripId: string): RecurringTrip[] {
    return trips.filter((trip) => trip.id !== tripId);
}
