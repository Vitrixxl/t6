// Distance sphérique entre deux points, utilisée pour les rayons « Autour de
// moi », les longueurs de tracé et le repère de ligne sur la carte.
import type { GeoPoint } from '../../types';

function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}

export function haversineDistanceKm(a: Pick<GeoPoint, 'lat' | 'lon'>, b: Pick<GeoPoint, 'lat' | 'lon'>): number {
    const radiusKm = 6371;
    const dLat = toRadians(b.lat - a.lat);
    const dLon = toRadians(b.lon - a.lon);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const value =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
