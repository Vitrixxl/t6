// Profil attribue a la creation d'un compte, avant toute personnalisation.
// Isole ici parce que le stockage et la validation en dependent tous les deux :
// le placer dans l'un des deux creerait un cycle d'imports.
import type { MobilityProfile } from '../../types';

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
