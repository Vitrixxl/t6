import { expect, it } from 'bun:test';
import { tripEvolution } from './trip-evolution';
import { summarizeCarbon } from './carbon';
import type { RecurringTrip, TripRecord } from '../types';

const routine: RecurringTrip = {
    id: 'r', userId: 'u', label: 'Vélo', origin: { label: 'A', lat: 45, lon: 4 }, destination: { label: 'B', lat: 45, lon: 4 },
    modes: ['bike'], distanceKm: 4, durationMinutes: 20, carbonGrams: 40, carbonSavedGrams: 100,
    createdAt: '2025-01-01T00:00:00Z', timeZone: 'Europe/Paris', daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    departureTime: '08:00', returnTime: '18:00', periods: [{ from: '2025-01-01T00:00:00Z', to: null }], cancelledPassages: [],
};
function record(at: Date, savings: number | null = 100): TripRecord {
    return { ...routine, id: crypto.randomUUID(), routeTitle: 'Vélo', createdAt: at.toISOString(), carbonSavedGrams: savings };
}

it('sépare les semaines au lundi, ignore le futur et conserve les semaines vides au changement d’année', () => {
    const now = new Date(2026, 0, 5, 12);
    const rows = tripEvolution([
        record(new Date(2026, 0, 4, 23, 59)), record(new Date(2026, 0, 5), -50),
        record(new Date(2026, 0, 6)), record(new Date(2025, 0, 1)),
    ], [], now);
    expect(rows).toHaveLength(8);
    expect(rows.slice(0, 6).every((week) => week.trips === 0)).toBe(true);
    expect(rows[6]?.trips).toBe(1);
    expect(rows[7]?.trips).toBe(1);
    expect(rows[7]?.carbonSavedGrams).toBe(-50);
});

it('exclut pauses et sens annulés, puis les réintègre au rétablissement', () => {
    const now = new Date('2026-09-05T12:00:00Z');
    const cancelled: RecurringTrip = { ...routine, cancelledPassages: [{ date: '2026-09-01', direction: 'outbound' }] };
    const before = tripEvolution([], [routine], now)[7]!;
    const after = tripEvolution([], [cancelled], now)[7]!;
    expect(before.trips - after.trips).toBe(1);
    expect(before.carbonGrams - after.carbonGrams).toBe(40);
    const paused = { ...routine, periods: [{ from: routine.createdAt, to: '2026-08-01T00:00:00Z' }] };
    expect(tripEvolution([], [paused], now)[7]?.trips).toBe(0);
    const records = [record(new Date('2026-09-01T12:00:00Z'), null)];
    expect(tripEvolution(records, [cancelled], now)[7]?.carbonGrams).toBe(summarizeCarbon(records, [cancelled], 2500, now).totalCarbonGrams);
});

it('conserve les passages lors du changement d’heure à Paris', () => {
    const weeks = tripEvolution([], [routine], new Date('2026-03-30T12:00:00Z'));
    expect(weeks[6]?.trips).toBe(14);
});
