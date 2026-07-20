import { describe, expect, it } from 'vitest';
import { clearTripHistory, loadTripHistory, saveTripRecord, summarizeCarbon } from './carbon';
import type { TripRecord } from '../types';

// Les enregistrements sont produits en pratique par plannedTripToRecord
// (plannedTrips.ts) quand un trajet planifie est marque fait.
function makeTripRecord(userId: string, createdAt: Date = new Date()): TripRecord {
  return {
    id: crypto.randomUUID(),
    userId,
    routeTitle: 'Velo',
    modes: ['walk', 'bike'],
    distanceKm: 5,
    durationMinutes: 22,
    carbonGrams: 20,
    carbonSavedGrams: 880,
    createdAt: createdAt.toISOString(),
  };
}

describe('carbon tracking', () => {
  it('creates and summarizes trip records', () => {
    const trip = makeTripRecord('user-1', new Date('2026-09-14T08:00:00+02:00'));
    const summary = summarizeCarbon([trip], 2500);

    expect(trip.userId).toBe('user-1');
    expect(summary.trips).toBe(1);
    expect(summary.totalCarbonGrams).toBe(20);
    expect(summary.totalSavedGrams).toBe(880);
    expect(summary.goalUsagePercent).toBe(1);
  });

  it('persists trip records per user', () => {
    const trip = makeTripRecord('user-2');
    const records = saveTripRecord(trip);

    expect(records).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('ufm.tripHistory.user-2') ?? '[]')).toHaveLength(1);
  });

  it('plafonne la jauge d\'objectif a 999 % et la neutralise si l\'objectif est nul', () => {
    const bigTrip = { ...makeTripRecord('user-3'), carbonGrams: 100000 };

    expect(summarizeCarbon([bigTrip], 2500).goalUsagePercent).toBe(999);
    expect(summarizeCarbon([bigTrip], 0).goalUsagePercent).toBe(0);
  });

  it('borne l\'historique aux 50 trajets les plus recents', () => {
    for (let index = 0; index < 55; index += 1) {
      saveTripRecord(makeTripRecord('user-4'));
    }

    expect(loadTripHistory('user-4')).toHaveLength(50);
  });

  it('purge un historique corrompu au lieu de planter (robustesse localStorage)', () => {
    localStorage.setItem('ufm.tripHistory.user-5', '{corrompu');

    expect(loadTripHistory('user-5')).toEqual([]);
    expect(localStorage.getItem('ufm.tripHistory.user-5')).toBeNull();
  });

  it('clearTripHistory supprime uniquement l\'historique de l\'utilisateur vise', () => {
    saveTripRecord(makeTripRecord('user-6'));
    saveTripRecord(makeTripRecord('user-7'));

    clearTripHistory('user-6');

    expect(loadTripHistory('user-6')).toEqual([]);
    expect(loadTripHistory('user-7')).toHaveLength(1);
  });
});
