// Modèle de score. Le score part de la fiabilité de l'option, ajoute un bonus
// par mode préféré et retranche des pénalités (durée, carbone, inaccessibilite
// PMR, avertissements). Les coefficients sont testes (planner.test.ts).
import type { MobilityProfile, RouteOption } from '../../types';

export const SCORING_WEIGHTS = {
    preferenceBonusPerMode: 8,
    carbonDivisor: 55,
    timePenaltyPerMinute: 0.85,
    accessibilityPenalty: 45,
    warningPenalty: 6,
} as const;

export function scoreOption(option: RouteOption, profile: MobilityProfile): RouteOption {
    const w = SCORING_WEIGHTS;
    const preferenceBonus = option.modes.reduce((sum, mode) => sum + (profile.preferredModes.includes(mode) ? w.preferenceBonusPerMode : 0), 0);
    const carbonPenalty = option.carbonGrams / w.carbonDivisor;
    const timePenalty = option.durationMinutes * w.timePenaltyPerMinute;
    const accessibilityPenalty = profile.accessibilityNeed && !option.accessible ? w.accessibilityPenalty : 0;

    const warningPenalty = option.warnings.length * w.warningPenalty;

    const score = Math.round(option.reliabilityScore + preferenceBonus - carbonPenalty - timePenalty - accessibilityPenalty - warningPenalty);

    return {
        ...option,
        score: Math.min(Math.max(score, 0), 100),
    };
}
