// Profil de mobilité : ce dont l'utilisateur dispose pour se déplacer, son
// besoin PMR et ses objectifs. Les bornes sont celles des champs de
// l'interface ; le formulaire les vérifie avant l'envoi, le serveur à la réception.
import { z } from 'zod';
import { AVAILABLE_MODES, availableModes, isoDate } from './primitives';

/** Valeurs appliquées aux profils crees avant l'ajout des objectifs. */
export const DEFAULT_WEEKLY_TRIPS_GOAL = 5;
export const DEFAULT_WEEKLY_SAVED_GOAL_GRAMS = 2000;
export const DEFAULT_MONTHLY_SAVED_GOAL_GRAMS = 8000;

export const mobilityProfile = z.object({
    displayName: z
        .string()
        .min(1, 'Le nom affiché est obligatoire.')
        .max(60, '60 caractères au plus.')
        // Les chevrons n'ont rien à faire dans un nom : refuses plutôt que retirés en silence.
        .regex(/^[^<>]*$/, 'Le nom ne peut pas contenir de chevrons.'),
    /** Vélo'v, Dott, transport en commun. Vide, seule la marche est proposée. */
    availableModes,
    accessibilityNeed: z.boolean(),
    carbonGoalGramsPerWeek: z.number().min(250, '250 g au moins.').max(20_000, '20 000 g au plus.'),
    /** Objectifs saisis par l'utilisateur (absents sur les anciens profils). */
    weeklyTripsGoal: z.int().min(1, '1 trajet au moins.').max(60, '60 trajets au plus.').optional(),
    weeklySavedGoalGrams: z.number().min(100, '100 g au moins.').max(50_000, '50 000 g au plus.').optional(),
    monthlySavedGoalGrams: z.number().min(100, '100 g au moins.').max(200_000, '200 000 g au plus.').optional(),
    /**
     * Instant où l'utilisateur a répondu aux deux questions d'accueil, ses
     * moyens de transport et son besoin PMR. `null` tant qu'elles n'ont pas
     * été posées : l'application les pose avant la première recherche.
     */
    onboardedAt: isoDate.nullable(),
});
export type MobilityProfile = z.infer<typeof mobilityProfile>;

/** Profil attribue à la création d'un compte, avant les questions d'accueil. */
export const DEFAULT_PROFILE: MobilityProfile = {
    displayName: 'Citoyen UrbanFlow',
    availableModes: [...AVAILABLE_MODES],
    accessibilityNeed: false,
    carbonGoalGramsPerWeek: 2500,
    weeklyTripsGoal: DEFAULT_WEEKLY_TRIPS_GOAL,
    weeklySavedGoalGrams: DEFAULT_WEEKLY_SAVED_GOAL_GRAMS,
    monthlySavedGoalGrams: DEFAULT_MONTHLY_SAVED_GOAL_GRAMS,
    onboardedAt: null,
};
