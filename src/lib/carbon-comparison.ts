// Libelles uniques pour la comparaison contrefactuelle avec la voiture.
// Le signe est une information metier : une economie negative devient des
// emissions supplementaires, jamais un zero silencieux ni un nombre « evite ».

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
