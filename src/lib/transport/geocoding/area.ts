// Bornage geographique de la recherche : la plateforme sert une metropole, pas
// le monde entier. Filtrer cote client evite d'afficher des resultats hors
// perimetre que l'utilisateur ne pourrait de toute facon pas rejoindre.
export const SEARCH_CENTER = { lat: 45.7578, lon: 4.832 };
export const SEARCH_DEPARTMENT = '69';
export const METRO_BBOX = { minLon: 4.62, minLat: 45.55, maxLon: 5.08, maxLat: 45.94 };

export function inMetroBbox(lon: number, lat: number): boolean {
  return lon >= METRO_BBOX.minLon && lon <= METRO_BBOX.maxLon && lat >= METRO_BBOX.minLat && lat <= METRO_BBOX.maxLat;
}
