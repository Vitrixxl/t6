import { describe, expect, it } from 'bun:test';
import { formatCarbonComparison, formatCarbonComparisonCompact } from './carbon-comparison';

describe('formatCarbonComparison', () => {
    it('distingue une économie, un surplus et une référence indisponible', () => {
        expect(formatCarbonComparison(426)).toBe('426 gCO₂e évités');
        expect(formatCarbonComparison(-12)).toBe('12 gCO₂e supplémentaires');
        expect(formatCarbonComparison(null)).toBe('Comparaison voiture indisponible');
        expect(formatCarbonComparisonCompact(-12)).toBe('12 gCO₂e en plus');
    });
});
