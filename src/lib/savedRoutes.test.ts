import { describe, expect, it } from '../test/harness';
import { SAVED_ROUTES_LIMIT } from '../contracts/limits';
import { addSavedRoute, createSavedRouteRecord, removeSavedRoute } from './savedRoutes';
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
    carbonReference: { distanceKm: 3, carbonGrams: 426, factorVersion: 'test-car-factor' },
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

        expect(addSavedRoute(addSavedRoute([], first), second)).toHaveLength(1);
    });

    it('distingue les trajets par origine-destination et par option', () => {
        const aller = createSavedRouteRecord('user-1', origin, destination, option);
        const retour = createSavedRouteRecord('user-1', destination, origin, option);

        expect(addSavedRoute(addSavedRoute([], aller), retour)).toHaveLength(2);
    });

    it('supprime un trajet sauvegarde par identifiant', () => {
        const record = createSavedRouteRecord('user-1', origin, destination, option);

        expect(removeSavedRoute(addSavedRoute([], record), record.id)).toEqual([]);
    });

    it('borne la liste aux plus recents', () => {
        let records = addSavedRoute([], createSavedRouteRecord('user-1', origin, destination, option));
        for (let index = 0; index < SAVED_ROUTES_LIMIT + 5; index += 1) {
            const point = { ...destination, label: `Point ${index}` };
            records = addSavedRoute(records, createSavedRouteRecord('user-1', origin, point, option));
        }

        expect(records).toHaveLength(SAVED_ROUTES_LIMIT);
        expect(records[0].destination.label).toBe(`Point ${SAVED_ROUTES_LIMIT + 4}`);
    });
});
