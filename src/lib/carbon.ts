import type { CarbonSummary, TripRecord } from '../types';
import { enqueueOperation } from './api/outbox';

const TRIP_HISTORY_PREFIX = 'ufm.tripHistory.';

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
  // L'ecriture locale fait foi pour l'affichage immediat ; le serveur est
  // rattrape par la file de synchronisation, meme si le reseau est absent.
  const { userId, ...payload } = record;
  enqueueOperation(userId, { kind: 'trip.record', record: payload });
  return records;
}

export function clearTripHistory(userId: string): void {
  localStorage.removeItem(storageKey(userId));
  enqueueOperation(userId, { kind: 'trip.history.clear' });
}

/** Remplace le cache local par l'etat du serveur (hydratation apres connexion). */
export function replaceTripHistory(userId: string, records: TripRecord[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(records));
}

function storageKey(userId: string): string {
  return `${TRIP_HISTORY_PREFIX}${userId}`;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
