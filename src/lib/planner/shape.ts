// Repère d'étiquette sur un tracé.
import type { GeoPoint } from '../../types';
import { haversineDistanceKm } from './geo';

/**
 * Point situé à mi-longueur du tracé, et non à son point médian.
 *
 * Les sommets d'un tracé sont denses dans les courbes et rares sur les lignes
 * droites : la moitié des points peut tenir dans le premier dixième du
 * parcours. Prendre l'index médian collait donc l'étiquette de ligne à une
 * extrémité, par-dessus le repère de départ.
 */
export function midpointOfPath(path: GeoPoint[]): GeoPoint | null {
    if (path.length === 0) {
        return null;
    }
    if (path.length < 3) {
        return path[Math.floor(path.length / 2)];
    }

    const spans = path.slice(1).map((point, index) => haversineDistanceKm(path[index], point));
    const half = spans.reduce((sum, span) => sum + span, 0) / 2;

    let walked = 0;
    for (let index = 0; index < spans.length; index += 1) {
        if (walked + spans[index] >= half) {
            // Interpolation linéaire dans le segment qui porte la moitié : sur
            // quelques dizaines de mètres, la courbure de la Terre est négligeable.
            const ratio = spans[index] === 0 ? 0 : (half - walked) / spans[index];
            const from = path[index];
            const to = path[index + 1];
            return {
                label: 'Milieu du segment',
                lat: from.lat + ratio * (to.lat - from.lat),
                lon: from.lon + ratio * (to.lon - from.lon),
            };
        }
        walked += spans[index];
    }

    return path[path.length - 1];
}
