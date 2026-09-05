import type { RecurringTrip, TripRecord } from '../types';
import { sumRoutines } from './trips/routines';
import { startOfWeek } from './week';

export interface TripWeek {
    start: Date;
    trips: number;
    distanceKm: number;
    carbonGrams: number;
    carbonSavedGrams: number;
}

/** Huit semaines civiles, dont celle en cours ; mêmes sources que le budget. */
export function tripEvolution(records: TripRecord[], recurring: RecurringTrip[], now: Date): TripWeek[] {
    const monday = startOfWeek(now);
    return Array.from({ length: 8 }, (_, index) => {
        const start = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - (7 - index) * 7);
        const next = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
        const end = new Date(Math.min(next.getTime(), now.getTime()));
        const totals = sumRoutines(recurring, start, end);
        for (const record of records) {
            const at = new Date(record.createdAt);
            if (at < start || at >= end) continue;
            totals.trips += 1;
            totals.distanceKm += record.distanceKm;
            totals.carbonGrams += record.carbonGrams;
            totals.carbonSavedGrams += record.carbonSavedGrams ?? 0;
        }
        return { start, ...totals, distanceKm: Math.round(totals.distanceKm * 100) / 100,
            carbonGrams: Math.round(totals.carbonGrams), carbonSavedGrams: Math.round(totals.carbonSavedGrams) };
    });
}
