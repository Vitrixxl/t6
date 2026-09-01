// Constantes du moteur d'itineraires : vitesses, facteurs d'emission et
// reperes. Centralisees et testees, elles sont les seules valeurs chiffrees du
// modele - aucun nombre magique n'est disperse dans les generateurs d'options.
import type { GeoPoint, MobilityMode } from '../../types';

export const SPEED_KMH: Record<MobilityMode, number> = {
  walk: 4.6,
  bike: 15,
  scooter: 18,
  transit: 28,
  carpool: 23,
};

/**
 * Emissions **du vehicule**, en g/km. Le covoiturage vaut la voiture
 * individuelle : c'est le meme vehicule, il emet autant. Ce qui change est la
 * part imputee a chaque passager, calculee par segment a partir du nombre
 * d'occupants (voir `LegEstimate.carbonGramsPerKm`).
 */
export const EMISSIONS_G_PER_KM: Record<MobilityMode | 'privateCar', number> = {
  walk: 0,
  bike: 4,
  scooter: 15,
  transit: 55,
  carpool: 180,
  privateCar: 180,
};

/**
 * Occupants retenus quand le profil ne dit rien. Deux, soit le conducteur et
 * un passager : l'hypothese la plus basse qui merite encore le nom de
 * covoiturage.
 */
export const DEFAULT_CARPOOL_OCCUPANTS = 2;
export const MIN_CARPOOL_OCCUPANTS = 1;
export const MAX_CARPOOL_OCCUPANTS = 5;

export const MODE_LABELS: Record<MobilityMode, string> = {
  walk: 'marche',
  bike: 'velo',
  scooter: 'trottinette',
  transit: 'transport public',
  carpool: 'covoiturage',
};

// Coefficients du modele de score, centralises et testes (routePlanner.test.ts).
// Le score part de la fiabilite de l'option, ajoute un bonus par mode prefere et

// RG3 : un segment velo/trottinette n'est propose que si une station est a portee de marche.
export const MAX_STATION_ACCESS_KM = 0.4;

export const LANDMARKS: GeoPoint[] = [
  { label: 'Bellecour', lat: 45.7578, lon: 4.832 },
  { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 },
  { label: 'Confluence', lat: 45.7406, lon: 4.8194 },
  { label: 'Grange Blanche', lat: 45.7435, lon: 4.8797 },
  { label: 'Vaise', lat: 45.7797, lon: 4.8053 },
];
