import { describe, expect, it } from 'vitest';
import { createSavedRouteRecord, deleteSavedRouteRecord, loadSavedRoutes, saveSavedRouteRecord } from './savedRoutes';
import type { GeoPoint, RouteOption } from '../types';

const origin: GeoPoint = { label: 'Bellecour', lat: 45.7578, lon: 4.832 };
const destination: GeoPoint = { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 };

const option: RouteOption = {
  id: 'bike',
  title: 'Velo partage bas carbone',
  summary: 'Test',
  modes: ['walk', 'bike'],
  legs: [],
  path: [],
  distanceKm: 2.4,
  durationMinutes: 12,
  carbonGrams: 10,
  carbonSavedGrams: 420,
  reliabilityScore: 86,
  score: 84,
  accessible: true,
  warnings: [],
  instructions: [],
};

describe('savedRoutes', () => {
  it('genere un identifiant stable: sauvegarder deux fois le meme trajet ne cree pas de doublon', () => {
    const first = createSavedRouteRecord('user-1', origin, destination, option);
    const second = createSavedRouteRecord('user-1', origin, destination, option);
    expect(first.id).toBe(second.id);

    saveSavedRouteRecord(first);
    const records = saveSavedRouteRecord(second);
    expect(records).toHaveLength(1);
  });

  it('distingue les trajets par origine-destination et par option', () => {
    saveSavedRouteRecord(createSavedRouteRecord('user-1', origin, destination, option));
    const records = saveSavedRouteRecord(
      createSavedRouteRecord('user-1', destination, origin, option),
    );

    expect(records).toHaveLength(2);
  });

  it('supprime un trajet sauvegarde par identifiant', () => {
    const record = createSavedRouteRecord('user-1', origin, destination, option);
    saveSavedRouteRecord(record);

    const remaining = deleteSavedRouteRecord('user-1', record.id);
    expect(remaining).toEqual([]);
    expect(loadSavedRoutes('user-1')).toEqual([]);
  });

  it('purge une sauvegarde corrompue au lieu de planter', () => {
    localStorage.setItem('ufm.savedRoutes.user-2', 'pas du json');

    expect(loadSavedRoutes('user-2')).toEqual([]);
    expect(localStorage.getItem('ufm.savedRoutes.user-2')).toBeNull();
  });
});
