import type { CarbonSummary, RouteOption, TripRecord } from '../types';

const TRIP_HISTORY_PREFIX = 'ufm.tripHistory.';

export function createTripRecord(userId: string, option: RouteOption, now: Date = new Date()): TripRecord {
  return {
    id: crypto.randomUUID(),
    userId,
    routeTitle: option.title,
    modes: option.modes,
    distanceKm: option.distanceKm,
    durationMinutes: option.durationMinutes,
    carbonGrams: option.carbonGrams,
    carbonSavedGrams: option.carbonSavedGrams,
    createdAt: now.toISOString(),
  };
}

export function summarizeCarbon(records: TripRecord[], weeklyGoalGrams: number): CarbonSummary {
  const totalDistanceKm = round(records.reduce((sum, record) => sum + record.distanceKm, 0), 2);
  const totalCarbonGrams = Math.round(records.reduce((sum, record) => sum + record.carbonGrams, 0));
  const totalSavedGrams = Math.round(records.reduce((sum, record) => sum + record.carbonSavedGrams, 0));

  return {
    trips: records.length,
    totalDistanceKm,
    totalCarbonGrams,
    totalSavedGrams,
    goalUsagePercent: weeklyGoalGrams > 0 ? Math.min(Math.round((totalCarbonGrams / weeklyGoalGrams) * 100), 999) : 0,
  };
}

export function loadTripHistory(userId: string): TripRecord[] {
  const payload = localStorage.getItem(storageKey(userId));
  if (!payload) {
    return [];
  }

  try {
    return JSON.parse(payload) as TripRecord[];
  } catch {
    localStorage.removeItem(storageKey(userId));
    return [];
  }
}

export function saveTripRecord(record: TripRecord): TripRecord[] {
  const records = [record, ...loadTripHistory(record.userId)].slice(0, 50);
  localStorage.setItem(storageKey(record.userId), JSON.stringify(records));
  return records;
}

export function clearTripHistory(userId: string): void {
  localStorage.removeItem(storageKey(userId));
}

function storageKey(userId: string): string {
  return `${TRIP_HISTORY_PREFIX}${userId}`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
