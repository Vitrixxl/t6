import { atCalendarTime, calendarDate } from '../../../../src/lib/trips/calendar';
import type { TimetableMetadata } from '../../../../src/contracts/transit';

export function shiftedDate(date: string, days: number): string {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}

export function serviceStart(date: string, timeZone: string): number {
    // GTFS compte les secondes depuis midi moins douze heures, et non depuis
    // le minuit civil : ces deux instants divergent aux changements d'heure.
    return atCalendarTime(date, '12:00', timeZone).getTime() - 12 * 3600_000;
}

export function serviceDays(at: number, metadata: TimetableMetadata): string[] {
    const date = calendarDate(new Date(at), metadata.timeZone);
    const days = Math.floor(metadata.maxTimeSeconds / 86400);
    return Array.from({ length: days + 1 }, (_, index) => shiftedDate(date, -index))
        .filter((day) => day >= metadata.startDate && day <= metadata.endDate);
}
