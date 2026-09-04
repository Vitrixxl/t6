import { describe, expect, it } from '../test/harness';
import { formatCarbonComparison, formatCarbonComparisonCompact } from './carbon-comparison';

describe('formatCarbonComparison', () => {
    it('distingue une economie, un surplus et une reference indisponible', () => {
        expect(formatCarbonComparison(426)).toBe('426 gCO₂e évités');
        expect(formatCarbonComparison(-12)).toBe('12 gCO₂e supplémentaires');
        expect(formatCarbonComparison(null)).toBe('Comparaison voiture indisponible');
        expect(formatCarbonComparisonCompact(-12)).toBe('12 gCO₂e en plus');
    });
});
