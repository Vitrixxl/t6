// Libellés uniques pour la comparaison contrefactuelle avec la voiture.
// Le signe est une information métier : une économie négative devient des
// émissions supplémentaires, jamais un zéro silencieux ni un nombre « évite ».

export function formatCarbonFootprint(grams: number): string {
    return `${grams} gCO₂e`;
}

export function formatCarbonComparison(grams: number | null): string {
    if (grams === null) {
        return 'Comparaison voiture indisponible';
    }
    if (grams < 0) {
        return `${Math.abs(grams)} gCO₂e supplémentaires`;
    }
    return `${grams} gCO₂e évités`;
}

export function formatCarbonComparisonCompact(grams: number | null): string {
    if (grams === null) {
        return 'indisponible';
    }
    return grams < 0 ? `${Math.abs(grams)} gCO₂e en plus` : `${grams} gCO₂e évités`;
}
