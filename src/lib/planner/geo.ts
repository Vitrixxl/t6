// Calculs spatiaux : distances et recherche du point d'accès au réseau le plus
// proche.
import type { GeoPoint, GtfsStop, SharedStation } from '../../types';
import { MAX_STATION_ACCESS_KM } from './constants';
import { distanceToCenterKm, METRO_RADIUS_KM } from '../transport/feeds/area';

/** Nombre de points proches soumis au classement par temps de trajet réel. */
export const MAX_ACCESS_CANDIDATES = 8;

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

export function toRadians(value: number): number {
    return (value * Math.PI) / 180;
}

/**
 * Premier filtre, volontairement geometrique : tout trajet de moins de 400 m
 * sur la voirie est aussi à moins de 400 m’à vol d'oiseau. Le classement final
 * de ces huit candidats appartient a access.ts et repose sur OSRM.
 */
export function stationCandidates(stations: SharedStation[], point: GeoPoint): SharedStation[] {
    return stations
        .slice()
        .map((station) => ({ station, distanceKm: haversineDistanceKm(stationToPoint(station), point) }))
        .filter(({ distanceKm }) => distanceKm <= MAX_STATION_ACCESS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, MAX_ACCESS_CANDIDATES)
        .map(({ station }) => station);
}

// Repli déterministe des tests purs ; le parcours affiche utilise le classement OSRM.
export function nearestStation(stations: SharedStation[], point: GeoPoint): SharedStation | null {
    return stationCandidates(stations, point)[0] ?? null;
}

export function stopToPoint(stop: GtfsStop): GeoPoint {
    return {
        label: stop.stop_name,
        lat: stop.stop_lat,
        lon: stop.stop_lon,
    };
}

export function stationToPoint(station: SharedStation): GeoPoint {
    return {
        label: station.name,
        lat: station.lat,
        lon: station.lon,
    };
}

/**
 * Un vehicule en flotte libre se laisse où l'on veut — mais seulement dans la
 * zone de service de l'opérateur, sous peine d'immobilisation et de pénalité.
 *
 * Cette borne n'a pas d'équivalent pour le Vélo'v, qui se rend à une station :
 * la contrainte de fin de trajet y est déjà portée par RG3 aux deux extrémités.
 * Les deux modes partagés sont bornes, mais pas par la même règle — copier
 * celle du vélo sur la trottinette aurait exige une trottinette à l'arrivée,
 * ce qui n'a aucun sens pour une flotte libre (B17).
 */
export function withinServiceArea(point: Pick<GeoPoint, 'lat' | 'lon'>): boolean {
    return distanceToCenterKm(point.lat, point.lon) <= METRO_RADIUS_KM;
}
