import { describe, expect, it } from 'bun:test';
import { DEFAULT_PROFILE } from '../../contracts';
import type { RouteOption } from '../../types';
import { haversineDistanceKm, LANDMARKS, preselectRoute, rankRoutes, SCORING_WEIGHTS } from './index';

function option(id: string, modes: RouteOption['modes'], durationMinutes: number, extra: Partial<RouteOption> = {}): RouteOption {
    return {
        id, title: id, summary: '', modes, legs: [], path: [], distanceKm: 1, durationMinutes,
        carbonGrams: 0, carbonSavedGrams: null, carbonReference: null, reliabilityScore: 80,
        score: 0, accessible: true, warnings: [], instructions: [], ...extra,
    };
}

const routes = rankRoutes([
    option('transit-0', ['walk', 'transit'], 24),
    option('bike-0', ['walk', 'bike'], 18),
    option('walk-0', ['walk'], 35),
], DEFAULT_PROFILE);

describe('rankRoutes', () => {
    it('classe par durée croissante', () => {
        expect(routes.map((route) => route.id)).toEqual(['bike-0', 'transit-0', 'walk-0']);
    });

    it('applique un bonus de score aux modes préférés (poids centralisés)', () => {
        const [withBonus] = rankRoutes([option('bike-0', ['walk', 'bike'], 18)], { ...DEFAULT_PROFILE, preferredModes: ['bike'] });
        const [without] = rankRoutes([option('bike-0', ['walk', 'bike'], 18)], { ...DEFAULT_PROFILE, preferredModes: ['transit'] });
        expect(withBonus.score - without.score).toBe(SCORING_WEIGHTS.preferenceBonusPerMode);
    });

    it('pénalise une option inaccessible pour un profil PMR', () => {
        const [accessible] = rankRoutes([option('transit-0', ['walk', 'transit'], 24)], { ...DEFAULT_PROFILE, accessibilityNeed: true });
        const [inaccessible] = rankRoutes([option('transit-0', ['walk', 'transit'], 24, { accessible: false })], { ...DEFAULT_PROFILE, accessibilityNeed: true });
        expect(accessible.score - inaccessible.score).toBe(SCORING_WEIGHTS.accessibilityPenalty);
    });

    it('borne chaque score sur l’intervalle 0-100', () => {
        const [slow] = rankRoutes([option('walk-0', ['walk'], 600)], DEFAULT_PROFILE);
        const [fast] = rankRoutes([option('bike-0', ['walk', 'bike'], 1, { reliabilityScore: 100 })], { ...DEFAULT_PROFILE, preferredModes: ['walk', 'bike'] });
        expect(slow.score).toBe(0);
        expect(fast.score).toBe(100);
    });
});

describe('haversineDistanceKm', () => {
    it('retrouve la distance de référence d’un degré de longitude à l’équateur', () => {
        expect(haversineDistanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.2, 0);
    });

    it('est symétrique et nulle sur un point identique', () => {
        expect(haversineDistanceKm(LANDMARKS[0], LANDMARKS[0])).toBe(0);
        expect(haversineDistanceKm(LANDMARKS[0], LANDMARKS[1])).toBeCloseTo(haversineDistanceKm(LANDMARKS[1], LANDMARKS[0]), 10);
    });
});

describe('preselectRoute', () => {
    it('retient la plus rapide par défaut, même si elle n’est pas la mieux classée', () => {
        expect(preselectRoute(routes)?.id).toBe('bike-0');
    });

    it('retient la plus rapide parmi celles qui empruntent le mode choisi', () => {
        expect(preselectRoute(routes, 'transit')?.id).toBe('transit-0');
    });

    it('retombe sur la plus rapide quand le mode choisi n’existe pas sur ce trajet', () => {
        expect(preselectRoute(routes, 'scooter')?.id).toBe('bike-0');
    });

    it('ne renvoie rien quand aucune option n’existe', () => {
        expect(preselectRoute([])).toBeNull();
    });
});
