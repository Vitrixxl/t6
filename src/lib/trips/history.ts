// L’historique rapproche les trajets ponctuels et les journées des routines.
// Les passages restent calculés ; seules leurs annulations sont persistées.
import type { PlannedTrip, RecurringTrip } from '../../types';
import { calendarDate } from './calendar';
import { isPassageCancelled, routinePassagesBetween, type RoutinePassage } from './routines';

export interface RoutineHistoryDay {
    kind: 'recurring';
    id: string;
    at: string;
    date: string;
    routine: RecurringTrip;
    passages: Array<RoutinePassage & { cancelled: boolean }>;
}

export type TripHistoryEntry = RoutineHistoryDay | {
    kind: 'once';
    id: string;
    at: string;
    trip: PlannedTrip;
};

function routineHistory(routine: RecurringTrip, now: Date): RoutineHistoryDay[] {
    const days = new Map<string, RoutineHistoryDay>();
    const floor = new Date(routine.createdAt);
    for (const passage of routinePassagesBetween(routine, floor, now)) {
        const date = calendarDate(passage.at, routine.timeZone);
        const day = days.get(date) ?? {
            kind: 'recurring', id: `recurring:${routine.id}:${date}`, at: passage.at.toISOString(),
            date, routine, passages: [],
        };
        day.at = passage.at.toISOString();
        day.passages.push({ ...passage, cancelled: isPassageCancelled(routine, passage) });
        days.set(date, day);
    }
    return [...days.values()];
}

export function tripHistory(planned: PlannedTrip[], recurring: RecurringTrip[], now = new Date()): TripHistoryEntry[] {
    const once = planned
        .filter((trip) => trip.status !== 'planned' || new Date(trip.scheduledFor) < now)
        .map((trip): TripHistoryEntry => ({
            kind: 'once', id: `once:${trip.id}`, at: trip.completedAt ?? trip.scheduledFor, trip,
        }));
    return [...once, ...recurring.flatMap((routine) => routineHistory(routine, now))]
        .sort((a, b) => b.at.localeCompare(a.at));
}
