// Profil de mobilite : les preferences qui pilotent le calcul d'itineraire.
// Les bornes sont celles des curseurs de l'interface ; le formulaire les
// verifie avant l'envoi, le serveur les verifie a la reception.
import { z } from 'zod';
import { mobilityMode, requiredModes } from './primitives';

/**
 * `'fastest'` ou un mode. Le mode n'est pas un filtre : si aucune option ne
 * l'emprunte pour ce trajet, la plus rapide reste selectionnee, et toutes les
 * options restent proposees.
 */
export const routePreselection = z.union([z.literal('fastest'), mobilityMode]);
export type RoutePreselection = z.infer<typeof routePreselection>;

export const mobilityProfile = z.object({
  displayName: z
    .string()
    .min(1, 'Le nom affiche est obligatoire.')
    .max(60, '60 caracteres au plus.')
    // Les chevrons n'ont rien a faire dans un nom : refuses plutot que retires en silence.
    .regex(/^[^<>]*$/, 'Le nom ne peut pas contenir de chevrons.'),
  preferredModes: requiredModes,
  maxWalkMinutes: z.int().min(5).max(45),
  accessibilityNeed: z.boolean(),
  avoidRain: z.boolean(),
  carbonGoalGramsPerWeek: z.number().min(250, '250 g au moins.').max(20_000, '20 000 g au plus.'),
  /** Objectifs hebdomadaires saisis par l'utilisateur (absents sur les anciens profils). */
  weeklyTripsGoal: z.int().min(1, '1 trajet au moins.').max(60, '60 trajets au plus.').optional(),
  weeklySavedGoalGrams: z.number().min(100, '100 g au moins.').max(50_000, '50 000 g au plus.').optional(),
  /** Option preselectionnee au calcul d'un itineraire. Absent sur les anciens profils : la plus rapide s'applique. */
  routePreselection: routePreselection.optional(),
});
export type MobilityProfile = z.infer<typeof mobilityProfile>;

/** Profil attribue a la creation d'un compte, avant toute personnalisation. */
export const DEFAULT_PROFILE: MobilityProfile = {
  displayName: 'Citoyen UrbanFlow',
  preferredModes: ['transit', 'bike', 'walk'],
  maxWalkMinutes: 15,
  accessibilityNeed: false,
  avoidRain: true,
  carbonGoalGramsPerWeek: 2500,
  weeklyTripsGoal: 5,
  weeklySavedGoalGrams: 2000,
  routePreselection: 'fastest',
};
