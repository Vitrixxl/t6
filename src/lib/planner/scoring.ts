// Modèle de score. Le score part de la fiabilité de l'option, ajoute un bonus
// par mode préféré et retranche des pénalités (durée, carbone, inaccessibilite
// PMR, avertissements). Les coefficients sont testes (planner.test.ts).
import type { MobilityProfile, RouteOption } from '../../types';
import { totalWalkMinutes } from './rules';

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

    // RG5 : au-delà de la marche maximale du profil, un avertissement est ajouté
    // et l'option est pénalisée (1 point par minute de marche excédentaire).
    const walkMinutes = totalWalkMinutes(option);
    const walkExcess = Math.max(walkMinutes - profile.maxWalkMinutes, 0);
    const warnings = walkExcess > 0
        ? [...option.warnings, `Marche de ${Math.round(walkMinutes)} min supérieure à ta limite de ${profile.maxWalkMinutes} min.`]
        : option.warnings;
    const warningPenalty = warnings.length * w.warningPenalty + walkExcess;

    const score = Math.round(option.reliabilityScore + preferenceBonus - carbonPenalty - timePenalty - accessibilityPenalty - warningPenalty);

    return {
        ...option,
        warnings,
        score: Math.min(Math.max(score, 0), 100),
    };
}
