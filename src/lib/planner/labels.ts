// Libelles affiches. `routeLabel` ne renvoie qu'un mode generique : sans
// graphe horaire, le numero de ligne desservant une paire d'arrets n'est jamais
// garanti, on ne l'affiche donc pas (limite assumee, cf. dossier 7.3).
import type { GtfsRoute, MobilityMode } from '../../types';

export const MODE_LABELS: Record<MobilityMode, string> = {
  walk: 'marche',
  bike: 'velo',
  scooter: 'trottinette',
  transit: 'transport public',
  carpool: 'covoiturage',
};

// Coefficients du modele de score, centralises et testes (routePlanner.test.ts).
// Le score part de la fiabilite de l'option, ajoute un bonus par mode prefere et

export function routeLabel(route: GtfsRoute): string {
  if (route.route_type === 1) return 'Metro';
  if (route.route_type === 0) return 'Tram';
  if (route.route_type === 7) return 'Funiculaire';
  return 'Transport public';
}
