// Création d'un trajet programmé ou d'une routine à partir d'un trajet source
// (option calculée ou itinéraire enregistré).
import type { GeoPoint, MobilityMode, PlannedTrip, RecurringTrip } from '../../types';

export const WEEKDAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Données minimales d'un trajet source (option calculée ou trajet enregistre). */
export interface TripSource {
    label: string;
    origin: GeoPoint;
    destination: GeoPoint;
    modes: MobilityMode[];
    distanceKm: number;
    durationMinutes: number;
    carbonGrams: number;
    carbonSavedGrams: number | null;
}

export function createPlannedTrip(
    userId: string,
    source: TripSource,
    scheduledFor: Date,
    now: Date = new Date(),
): PlannedTrip {
    return {
        id: crypto.randomUUID(),
        userId,
        label: source.label,
        origin: source.origin,
        destination: source.destination,
        modes: source.modes,
        distanceKm: source.distanceKm,
        durationMinutes: source.durationMinutes,
        carbonGrams: source.carbonGrams,
        carbonSavedGrams: source.carbonSavedGrams,
        scheduledFor: scheduledFor.toISOString(),
        status: 'planned',
        createdAt: now.toISOString(),
        completedAt: null,
    };
}

export function createRecurringTrip(
    userId: string,
    source: TripSource,
    schedule: { daysOfWeek: number[]; departureTime: string; returnTime: string | null },
    now: Date = new Date(),
): RecurringTrip {
    return {
        id: crypto.randomUUID(),
        userId,
        label: source.label,
        origin: source.origin,
        destination: source.destination,
        modes: source.modes,
        distanceKm: source.distanceKm,
        durationMinutes: source.durationMinutes,
        carbonGrams: source.carbonGrams,
        carbonSavedGrams: source.carbonSavedGrams,
        daysOfWeek: [...schedule.daysOfWeek].sort((a, b) => a - b),
        departureTime: schedule.departureTime,
        returnTime: schedule.returnTime,
        // Active des sa création : ses passages comptent à partir de maintenant.
        periods: [{ from: now.toISOString(), to: null }],
        createdAt: now.toISOString(),
    };
}
