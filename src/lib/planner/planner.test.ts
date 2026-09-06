import { describe, expect, it } from 'bun:test';
import { haversineDistanceKm, LANDMARKS } from './index';

describe('haversineDistanceKm', () => {
    it('retrouve la distance de référence d’un degré de longitude à l’équateur', () => {
        expect(haversineDistanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.2, 0);
    });

    it('est symétrique et nulle sur un point identique', () => {
        expect(haversineDistanceKm(LANDMARKS[0], LANDMARKS[0])).toBe(0);
        expect(haversineDistanceKm(LANDMARKS[0], LANDMARKS[1])).toBeCloseTo(haversineDistanceKm(LANDMARKS[1], LANDMARKS[0]), 10);
    });
});
