import { describe, expect, it } from 'bun:test';
import type { RouteOption } from '../../types';
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

describe('référence carbone voiture', () => {
    it('mesure 3 km avec le facteur voiture versionne a 142 gCO2e/km', () => {
        const reference = createCarbonReference({
            distanceMeters: 3000,
            durationSeconds: 600,
        });

        expect(CAR_REFERENCE_FACTOR.gramsCo2ePerPassengerKm).toBe(142);
        expect(reference).toEqual({
            distanceKm: 3,
            carbonGrams: 426,
            factorVersion: 'ademe-2025-car-diesel-average-142',
        });
    });

    it('applique exactement la même référence a des options de distances diffèrentes', () => {
        const reference = createCarbonReference({ distanceMeters: 3000, durationSeconds: 600 });
        const [shortOption, longOption] = applyCarbonReference(
            [option('court', 2, 100), option('long', 5, 500)],
            reference,
        );

        expect(shortOption.carbonReference).toBe(reference);
        expect(longOption.carbonReference).toBe(reference);
        expect(shortOption.carbonSavedGrams).toBe(326);
        // L'option fait 5 km, mais la référence reste 3 x 142 = 426 gCO2e.
        expect(longOption.carbonSavedGrams).toBe(-74);
    });


    it("n'invente aucune économie quand la mesure voiture est indisponible", () => {
        const [result] = applyCarbonReference([option('marche', 5, 0)], null);

        expect(result.carbonReference).toBeNull();
        expect(result.carbonSavedGrams).toBeNull();
    });
});

describe('facteurs GTFS', () => {
    it('distingue tramway, métro et approximation funiculaire', () => {
        expect(transitEmissionFactor(0).gramsCo2ePerPassengerKm).toBe(3.8);
        expect(transitEmissionFactor(1).gramsCo2ePerPassengerKm).toBe(4.2);
        expect(transitEmissionFactor(7).approximation).toContain('funiculaire');
    });
});
