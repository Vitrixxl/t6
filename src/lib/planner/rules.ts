// Regles de gestion appliquees aux options produites.
import type { RouteOption } from '../../types';

export function totalWalkMinutes(option: RouteOption): number {
  return option.legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + leg.durationMinutes, 0);
}
