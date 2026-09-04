// Constantes physiques du moteur d'itinéraires : vitesses et reperes.
// Les facteurs carbone, qui portent une source et une version, vivent dans
// émissions.ts.
import type { GeoPoint, MobilityMode } from '../../types';

export const SPEED_KMH: Record<MobilityMode, number> = {
    walk: 4.6,
    bike: 15,
    scooter: 18,
    transit: 28,
};

export const MODE_LABELS: Record<MobilityMode, string> = {
    walk: 'marche',
    bike: 'velo',
    scooter: 'trottinette',
    transit: 'transport public',
};

// Coefficients du modèle de score, centralisés et testes (routePlanner.test.ts).
// Le score part de la fiabilité de l'option, ajoute un bonus par mode préféré et

// RG3 : un segment vélo/trottinette n'est propose que si une station est à portée de marche.
export const MAX_STATION_ACCESS_KM = 0.4;

export const LANDMARKS: GeoPoint[] = [
    { label: 'Bellecour', lat: 45.7578, lon: 4.832 },
    { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 },
    { label: 'Confluence', lat: 45.7406, lon: 4.8194 },
    { label: 'Grange Blanche', lat: 45.7435, lon: 4.8797 },
    { label: 'Vaise', lat: 45.7797, lon: 4.8053 },
];
