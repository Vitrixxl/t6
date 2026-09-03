import type { RouteOption } from '../types';

// Couleurs de trace par mode dominant. Isole du composant carte (qui charge
// MapLibre) pour rester importable sans embarquer la librairie cartographique.
export const ROUTE_COLORS: Record<string, string> = {
  transit: '#2f6cb3',
  bike: '#1d6b4f',
  scooter: '#d97706',
  // Couleur de repli : une option sans mode motorise ni engin, donc la marche.
  walk: '#7c5cbf',
};

export function getRouteColor(route: RouteOption): string {
  if (route.modes.includes('transit')) return ROUTE_COLORS.transit;
  if (route.modes.includes('bike')) return ROUTE_COLORS.bike;
  if (route.modes.includes('scooter')) return ROUTE_COLORS.scooter;
  return ROUTE_COLORS.walk;
}
