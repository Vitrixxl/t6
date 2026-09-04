import { describe, expect, it } from '../../test/harness';
import { DEFAULT_PROFILE } from '../../contracts';
import type { RouteOption } from '../../types';
import { measureRoutes } from '.';
import { buildOption, createLeg } from './legs';
import {
    CAR_REFERENCE_FACTOR,
    applyCarbonReference,
    createCarbonReference,
    transitEmissionFactor,
} from './emissions';

function option(id: string, distanceKm: number, carbonGrams: number): RouteOption {
    return {
        id,
        title: id,
        summary: '',
        modes: ['walk'],
        legs: [],
        path: [],
        distanceKm,
        durationMinutes: 1,
        carbonGrams,
        carbonSavedGrams: null,
        carbonReference: null,
        reliabilityScore: 100,
        score: 100,
        accessible: true,
        warnings: [],
        instructions: [],
    };
}

describe('reference carbone voiture', () => {
    it('mesure 3 km avec le facteur voiture versionne a 142 gCO2e/km', () => {
        const reference = createCarbonReference({
            distanceMeters: 3000,
            durationSeconds: 600,
            source: 'upstream',
        });

        expect(CAR_REFERENCE_FACTOR.gramsCo2ePerPassengerKm).toBe(142);
        expect(reference).toEqual({
            distanceKm: 3,
            carbonGrams: 426,
            factorVersion: 'ademe-2025-car-diesel-average-142',
        });
    });

    it('applique exactement la meme reference a des options de distances differentes', () => {
        const reference = createCarbonReference({ distanceMeters: 3000, durationSeconds: 600, source: 'cache' });
        const [shortOption, longOption] = applyCarbonReference(
            [option('court', 2, 100), option('long', 5, 500)],
            reference,
        );

        expect(shortOption.carbonReference).toBe(reference);
        expect(longOption.carbonReference).toBe(reference);
        expect(shortOption.carbonSavedGrams).toBe(326);
        // L'option fait 5 km, mais la reference reste 3 x 142 = 426 gCO2e.
        expect(longOption.carbonSavedGrams).toBe(-74);
    });

    it('calcule la comparaison apres la mesure OSRM reelle des segments', async () => {
        const from = { label: 'Depart', lat: 45.75, lon: 4.83 };
        const to = { label: 'Arrivee', lat: 45.77, lon: 4.87 };
        const estimated = buildOption({
            id: 'velo-mesure',
            title: 'Velo mesure',
            summary: '',
            modes: ['bike'],
            legs: [
                createLeg({
                    id: 'velo',
                    title: 'Velo',
                    mode: 'bike',
                    from,
                    to,
                    distanceKm: 2,
                    accessible: true,
                }),
            ],
            reliabilityScore: 100,
            warnings: [],
        });

        const [measured] = await measureRoutes([estimated], DEFAULT_PROFILE, async (legs) =>
            legs.map((leg) => ({
                ...leg,
                distanceKm: 5,
                carbonGrams: 500,
                path: [from, to],
            })),
        );
        const [compared] = applyCarbonReference(
            [measured],
            createCarbonReference({ distanceMeters: 3000, durationSeconds: 600, source: 'upstream' }),
        );

        expect(estimated.distanceKm).toBe(2);
        expect(measured.distanceKm).toBe(5);
        expect(compared.carbonGrams).toBe(500);
        expect(compared.carbonSavedGrams).toBe(-74);
    });

    it("n'invente aucune economie quand la mesure voiture est indisponible", () => {
        const [result] = applyCarbonReference([option('marche', 5, 0)], null);

        expect(result.carbonReference).toBeNull();
        expect(result.carbonSavedGrams).toBeNull();
    });
});

describe('facteurs GTFS', () => {
    it('distingue tramway, metro et approximation funiculaire', () => {
        expect(transitEmissionFactor(0).gramsCo2ePerPassengerKm).toBe(3.8);
        expect(transitEmissionFactor(1).gramsCo2ePerPassengerKm).toBe(4.2);
        expect(transitEmissionFactor(7).approximation).toContain('funiculaire');
    });
});
