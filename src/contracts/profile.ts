// Profil de mobilité : les préférences qui pilotent le calcul d'itinéraire.
// Les bornes sont celles des curseurs de l'interface ; le formulaire les
// vérifie avant l'envoi, le serveur les vérifie à la réception.
import { z } from 'zod';
import { mobilityMode, requiredModes } from './primitives';

/**
 * `'fastest'` ou un mode. Le mode n'est pas un filtre : si aucune option ne
 * l'emprunte pour ce trajet, la plus rapide reste sélectionnée, et toutes les
 * options restent proposées.
 */
export const routePreselection = z.union([z.literal('fastest'), mobilityMode]);
export type RoutePreselection = z.infer<typeof routePreselection>;

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
    preferredModes: requiredModes,
    accessibilityNeed: z.boolean(),
    avoidRain: z.boolean(),
    carbonGoalGramsPerWeek: z.number().min(250, '250 g au moins.').max(20_000, '20 000 g au plus.'),
    /** Objectifs saisis par l'utilisateur (absents sur les anciens profils). */
    weeklyTripsGoal: z.int().min(1, '1 trajet au moins.').max(60, '60 trajets au plus.').optional(),
    weeklySavedGoalGrams: z.number().min(100, '100 g au moins.').max(50_000, '50 000 g au plus.').optional(),
    monthlySavedGoalGrams: z.number().min(100, '100 g au moins.').max(200_000, '200 000 g au plus.').optional(),
    /** Option preselectionnee au calcul d'un itinéraire. Absent sur les anciens profils : la plus rapide s'applique. */
    routePreselection: routePreselection.optional(),
});
export type MobilityProfile = z.infer<typeof mobilityProfile>;

/** Profil attribue à la création d'un compte, avant toute personnalisation. */
export const DEFAULT_PROFILE: MobilityProfile = {
    displayName: 'Citoyen UrbanFlow',
    preferredModes: ['transit', 'bike', 'walk'],
    accessibilityNeed: false,
    avoidRain: true,
    carbonGoalGramsPerWeek: 2500,
    weeklyTripsGoal: DEFAULT_WEEKLY_TRIPS_GOAL,
    weeklySavedGoalGrams: DEFAULT_WEEKLY_SAVED_GOAL_GRAMS,
    monthlySavedGoalGrams: DEFAULT_MONTHLY_SAVED_GOAL_GRAMS,
    routePreselection: 'fastest',
};
