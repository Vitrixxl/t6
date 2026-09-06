import { describe, expect, it } from 'bun:test';
import { SAVED_ROUTES_LIMIT } from '../contracts/limits';
import { savedRoute } from '../contracts/trips';
import { addSavedRoute, createSavedRouteRecord, removeSavedRoute } from './savedRoutes';
import type { GeoPoint, RouteOption } from '../types';

const origin: GeoPoint = { label: 'Bellecour', lat: 45.7578, lon: 4.832 };
const destination: GeoPoint = { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 };

const option: RouteOption = {
    id: 'bike',
    title: 'Vélo partagé bas carbone',
    summary: 'Test',
    modes: ['walk', 'bike'],
    legs: [],
    path: [],
    distanceKm: 2.4,
    durationMinutes: 12,
    carbonGrams: 10,
    carbonSavedGrams: 420,
    carbonReference: { distanceKm: 3, carbonGrams: 426, factorVersion: 'test-car-factor' },


    accessible: true,

    departureAt: '2026-09-06T08:00:00Z', arrivalAt: '2026-09-06T08:01:00Z',
    instructions: [],
};

describe('savedRoutes', () => {
    it('enregistre une variante avec de longues adresses sans dépasser le contrat de son identifiant', () => {
        const start = { ...origin, label: 'Adresse de départ '.repeat(7) };
        const end = { ...destination, label: 'Adresse d’arrivée '.repeat(7) };
        const variant = { ...option, id: `transit-${'a'.repeat(64)}` };
        const record = createSavedRouteRecord('user-1', start, end, variant);
        expect(savedRoute.safeParse(record).success).toBe(true);
        expect(createSavedRouteRecord('user-1', origin, destination, variant).id).toBe(record.id);
    });
    it('génère un identifiant stable: sauvegarder deux fois le même trajet ne crée pas de doublon', () => {
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

    it('borne la liste aux plus récents', () => {
        let records = addSavedRoute([], createSavedRouteRecord('user-1', origin, destination, option));
        for (let index = 0; index < SAVED_ROUTES_LIMIT + 5; index += 1) {
            const point = { ...destination, lat: destination.lat + index / 1000, label: `Point ${index}` };
            records = addSavedRoute(records, createSavedRouteRecord('user-1', origin, point, option));
        }

        expect(records).toHaveLength(SAVED_ROUTES_LIMIT);
        expect(records[0].destination.label).toBe(`Point ${SAVED_ROUTES_LIMIT + 4}`);
    });
});
