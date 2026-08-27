// Regles de gestion appliquees aux options produites.
import type { MobilityMode, RouteOption } from '../../types';

export function totalWalkMinutes(option: RouteOption): number {
  return option.legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + leg.durationMinutes, 0);
}

// RG1 : seuls les modes actives par l'utilisateur produisent des options visibles.
// La marche est un mode d'appoint : une option n'est filtree sur la marche que si
// elle est exclusivement pietonne.
export function matchesEnabledModes(option: RouteOption, enabledModes: MobilityMode[]): boolean {
  const primaryModes = option.modes.filter((mode) => mode !== 'walk');
  return primaryModes.length === 0 ? enabledModes.includes('walk') : primaryModes.every((mode) => enabledModes.includes(mode));
}
