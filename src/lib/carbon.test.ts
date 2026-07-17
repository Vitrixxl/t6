import { describe, expect, it } from 'vitest';
import { createTripRecord, saveTripRecord, summarizeCarbon } from './carbon';
import type { RouteOption } from '../types';

const option: RouteOption = {
  id: 'bike',
  title: 'Velo partage bas carbone',
  summary: 'Test',
  modes: ['walk', 'bike'],
  legs: [],
  path: [],
  distanceKm: 5,
  durationMinutes: 22,
  carbonGrams: 20,
  carbonSavedGrams: 880,
  reliabilityScore: 90,
  score: 82,
  accessible: true,
  warnings: [],
  instructions: [],
};

describe('carbon tracking', () => {
  it('creates and summarizes trip records', () => {
    const trip = createTripRecord('user-1', option, new Date('2026-09-14T08:00:00+02:00'));
    const summary = summarizeCarbon([trip], 2500);

    expect(trip.userId).toBe('user-1');
    expect(summary.trips).toBe(1);
    expect(summary.totalCarbonGrams).toBe(20);
    expect(summary.totalSavedGrams).toBe(880);
    expect(summary.goalUsagePercent).toBe(1);
  });

  it('persists trip records per user', () => {
    const trip = createTripRecord('user-2', option);
    const records = saveTripRecord(trip);

    expect(records).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('ufm.tripHistory.user-2') ?? '[]')).toHaveLength(1);
  });
});
