import { describe, expect, it } from 'bun:test';
import { createPlannedTrip, createRecurringTrip } from './factory';
import { countOccurrences, sumRoutines } from './routines';
import { tripHistory } from './history';
import { summarizeTripActivity, upcomingTrips } from './summary';
import { summarizeCarbon } from '../carbon';
import { atCalendarTime, calendarDate } from './calendar';
import type { CancelledPassage } from '../../contracts';

const source = {
    label: 'Travail', origin: { label: 'Départ', lat: 45.75, lon: 4.83 },
    destination: { label: 'Arrivée', lat: 45.76, lon: 4.84 },
    modes: ['bike' as const], distanceKm: 3, durationMinutes: 15, carbonGrams: 30, carbonSavedGrams: 400,
};
const floor = new Date('2026-09-01T00:00:00Z');
const now = new Date('2026-09-02T20:00:00Z');
function routine(cancelledPassages: CancelledPassage[] = []) {
    return {
        ...createRecurringTrip('user', source, { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], departureTime: '08:00', returnTime: '18:00' }, floor),
        timeZone: 'Europe/Paris', cancelledPassages,
    };
}

describe('historique et bilan des annulations', () => {
    it.each([
        [[], 4],
        [[{ date: '2026-09-01', direction: 'outbound' }], 3],
        [[{ date: '2026-09-01', direction: 'return' }], 3],
        [[{ date: '2026-09-01', direction: 'outbound' }, { date: '2026-09-01', direction: 'return' }], 2],
    ] satisfies Array<[CancelledPassage[], number]>)('exclut uniquement les sens annulés : %j', (exceptions, count) => {
        const trip = routine(exceptions);
        expect(countOccurrences(trip, floor, now)).toBe(count);
        expect(sumRoutines([trip], floor, now)).toEqual({ trips: count, distanceKm: count * 3, carbonGrams: count * 30, carbonSavedGrams: count * 400 });
        expect(summarizeCarbon([], [trip], 5000, now).totalCarbonGrams).toBe(count * 30);
        const activity = summarizeTripActivity([], [trip], now);
        expect(activity.doneThisWeek).toBe(count);
        expect(activity.savedThisMonthGrams).toBe(count * 400);
    });

    it('garde les annulations visibles et ne transforme pas les routines en trajets ponctuels', () => {
        const trip = routine([{ date: '2026-09-01', direction: 'outbound' }]);
        const history = tripHistory([], [trip], now);
        expect(history).toHaveLength(2);
        const day = history[1];
        if (day?.kind !== 'recurring') { throw new Error('Journée récurrente attendue'); }
        expect(day.date).toBe('2026-09-01');
        expect(day.passages.map((passage) => [passage.direction, passage.cancelled])).toEqual([['outbound', true], ['return', false]]);
        expect(upcomingTrips([], now)).toEqual([]);
    });

    it('place les ponctuels passés, faits et annulés dans l’historique et garde les futurs dans Une fois', () => {
        const past = createPlannedTrip('user', source, floor, floor);
        const future = createPlannedTrip('user', source, new Date('2026-09-03T10:00:00Z'), floor);
        const cancelled = { ...past, id: 'cancelled', status: 'cancelled' as const };
        const done = { ...past, id: 'done', status: 'done' as const, completedAt: '2026-09-02T10:00:00Z' };
        const trips = [past, future, cancelled, done];
        expect(upcomingTrips(trips, now).map((trip) => trip.id)).toEqual([future.id]);
        expect(tripHistory(trips, [], now)).toHaveLength(3);
    });

    it('ne propose dans l’historique que le sens déjà échu et respecte les pauses', () => {
        const trip = routine();
        const morning = tripHistory([], [trip], new Date('2026-09-01T07:00:00Z'))[0];
        if (morning?.kind !== 'recurring') { throw new Error('Journée récurrente attendue'); }
        expect(morning.passages.map((passage) => passage.direction)).toEqual(['outbound']);
        const paused = { ...trip, periods: [{ from: floor.toISOString(), to: '2026-09-01T12:00:00Z' }] };
        expect(countOccurrences(paused, floor, now)).toBe(1);
        expect(tripHistory([], [paused], now)).toHaveLength(1);
    });

    it('conserve le signe et l’absence de référence carbone après une annulation', () => {
        const trip = routine([{ date: '2026-09-01', direction: 'return' }]);
        expect(sumRoutines([{ ...trip, carbonSavedGrams: -10 }], floor, now).carbonSavedGrams).toBe(-30);
        expect(sumRoutines([{ ...trip, carbonSavedGrams: null }], floor, now).carbonSavedGrams).toBe(0);
        const history = tripHistory([], [{ ...trip, carbonSavedGrams: null }], now)[0];
        if (history?.kind !== 'recurring') { throw new Error('Journée récurrente attendue'); }
        expect(history.routine.carbonSavedGrams).toBeNull();
    });

    it('distingue deux sens prévus à la même heure', () => {
        const trip = { ...routine([{ date: '2026-09-01', direction: 'outbound' }]), returnTime: '08:00' };
        expect(countOccurrences(trip, floor, now)).toBe(3);
    });
});

describe('date civile de la routine', () => {
    it('conserve la date à minuit parisien même sur un serveur UTC', () => {
        expect(calendarDate(new Date('2026-09-01T22:30:00Z'), 'Europe/Paris')).toBe('2026-09-02');
        expect(atCalendarTime('2026-09-02', '00:30', 'Europe/Paris').toISOString()).toBe('2026-09-01T22:30:00.000Z');
    });
    it('applique les décalages d’été et d’hiver sans décaler le jour annulé', () => {
        expect(atCalendarTime('2026-03-28', '08:00', 'Europe/Paris').toISOString()).toBe('2026-03-28T07:00:00.000Z');
        expect(atCalendarTime('2026-03-29', '08:00', 'Europe/Paris').toISOString()).toBe('2026-03-29T06:00:00.000Z');
        expect(atCalendarTime('2026-03-29', '02:30', 'Europe/Paris').toISOString()).toBe('2026-03-29T01:30:00.000Z');
        expect(atCalendarTime('2026-10-25', '02:30', 'Europe/Paris').toISOString()).toBe('2026-10-25T01:30:00.000Z');
        expect(atCalendarTime('2026-10-25', '08:00', 'Europe/Paris').toISOString()).toBe('2026-10-25T07:00:00.000Z');
    });
});
