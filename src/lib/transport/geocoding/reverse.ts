// Geocodage inverse : d'un point de la carte vers une adresse lisible.
//
// Utilise pour nommer un point choisi par appui long. Sans cela, l'utilisateur
// verrait des coordonnées brutes dans son champ de recherche.
import type { GeoPoint } from '../../../types';
import { withTimeout } from '../http';

const REVERSE_URL = 'https://api-adresse.data.gouv.fr/reverse/';

interface ReverseResponse {
    features?: { properties?: { label?: string } }[];
}

/**
 * Rend un libellé pour un point. En cas d'échec (réseau, point hors couverture
 * BAN), on retombe sur les coordonnées : l'utilisateur garde un point
 * utilisable, seulement moins bien nomme.
 */
export async function describePoint(lat: number, lon: number, signal?: AbortSignal): Promise<GeoPoint> {
    const fallback: GeoPoint = { lat, lon, label: `Point (${lat.toFixed(4)}, ${lon.toFixed(4)})` };

    try {
        const response = await fetch(`${REVERSE_URL}?lon=${lon}&lat=${lat}&limit=1`, { signal: withTimeout(signal) });
        if (!response.ok) {
            return fallback;
        }
        const payload = (await response.json()) as ReverseResponse;
        const label = payload.features?.[0]?.properties?.label;
        return label ? { lat, lon, label } : fallback;
    } catch {
        return fallback;
    }
}
