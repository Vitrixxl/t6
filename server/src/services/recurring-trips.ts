// Commandes des routines. La borne est vérifiée côté serveur : un second
// appareil ne peut pas la contourner avec une vue locale périmée.
import { atCalendarTime, nextCalendarDate } from '../../../src/lib/trips/calendar.ts';
import { routinePassagesBetween } from '../../../src/lib/trips/routines.ts';
import type { Db } from '../db/index.ts';
import { createRepositories } from '../repositories/index.ts';
import { RECURRING_LIMIT, type RecurringTrip, type TripDirection } from '../../../src/contracts/index.ts';

export function saveRecurringTrip(db: Db, trip: Omit<RecurringTrip, 'cancelledPassages'>): RecurringTrip | null {
    return db.transaction((tx) => {
        const repository = createRepositories(tx).recurringTrips;
        if (!repository.findById(trip.userId, trip.id) && repository.count(trip.userId) >= RECURRING_LIMIT) {
            return null;
        }
        const current = repository.findById(trip.userId, trip.id);
        repository.upsert({ ...trip, cancelledPassages: current?.cancelledPassages ?? [] });
        return repository.findById(trip.userId, trip.id);
    });
}

/** Les sens demandés s’ajoutent atomiquement aux exceptions, sans effacer un autre appareil. */
export function cancelRecurringDate(
    db: Db,
    userId: string,
    id: string,
    date: string,
    directions: TripDirection[],
    now = new Date(),
): RecurringTrip | null {
    return db.transaction((tx) => {
        const repository = createRepositories(tx).recurringTrips;
        const routine = repository.findById(userId, id);
        if (!routine || !hasPastPassages(routine, date, directions, now)) {
            return null;
        }
        const cancelledPassages = routine.cancelledPassages.filter((item) =>
            item.date !== date || !directions.includes(item.direction));
        cancelledPassages.push(...[...new Set(directions)].map((direction) => ({ date, direction })));
        const updated = { ...routine, cancelledPassages };
        repository.upsert(updated);
        return updated;
    });
}

function hasPastPassages(routine: RecurringTrip, date: string, directions: TripDirection[], now: Date): boolean {
    const from = atCalendarTime(date, '00:00', routine.timeZone);
    const nextDay = atCalendarTime(nextCalendarDate(date), '00:00', routine.timeZone);
    const until = new Date(Math.min(nextDay.getTime(), now.getTime()));
    const passages = routinePassagesBetween(routine, from, until);
    return directions.every((direction) => passages.some((passage) => passage.direction === direction));
}
