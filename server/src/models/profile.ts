// Profil de mobilite : les preferences qui pilotent le calcul d'itineraire.
import { t } from 'elysia';
import { requiredModes } from './primitives.ts';
import type { MobilityProfile } from '../../../src/types.ts';

export const mobilityProfile = t.Object({
  displayName: t.String({ minLength: 1, maxLength: 60 }),
  preferredModes: requiredModes,
  // Bornes alignees sur le curseur de l'interface : le serveur ne fait pas
  // confiance au client pour les respecter.
  maxWalkMinutes: t.Integer({ minimum: 5, maximum: 45 }),
  accessibilityNeed: t.Boolean(),
  avoidRain: t.Boolean(),
  carbonGoalGramsPerWeek: t.Number({ minimum: 250, maximum: 20_000 }),
  weeklyTripsGoal: t.Optional(t.Integer({ minimum: 1, maximum: 60 })),
  weeklySavedGoalGrams: t.Optional(t.Number({ minimum: 100, maximum: 50_000 })),
  // Un vehicule particulier ne transporte pas plus de cinq personnes ; en
  // dessous d'une, il n'y a personne a bord.
  carpoolOccupants: t.Optional(t.Integer({ minimum: 1, maximum: 5 })),
});

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
  carpoolOccupants: 2,
};
