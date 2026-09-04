// Tracé de voirie, demande a notre propre API.
//
// Le navigateur demande ses tracés à l’API, qui appelle les moteurs locaux et
// partage leur cache entre utilisateurs. Le contrat contient la géométrie, la
// distance, la durée et les instructions nécessaires à l’affichage.
import type { GeoPoint, RouteInstruction, RouteMeasure, RoutableMode } from '../../../types';
import { api, treatyRequest } from '../../api/client';
import { withTimeout } from '../http';

export interface RouteGeometry {
    path: GeoPoint[];
    distanceMeters: number;
    durationSeconds: number;
    instructions: RouteInstruction[];
}

/**
 * Format attendu par l'API : `lon,lat`, une paire par paramètre.
 *
 * Six décimales valent une dizaine de centimetres, bien au-delà de la précision
 * d'un GPS de téléphone ou d'un point d'ancrage de station. Les tronquer évite
 * d'envoyer les treize décimales de certaines sources, et rapproche la requête
 * de la clé de cache du serveur : deux appels identiques à un mètre près ne
 * repartent pas chez le calculateur.
 */
function coordinates(point: Pick<GeoPoint, 'lat' | 'lon'>): string {
    return `${point.lon.toFixed(6)},${point.lat.toFixed(6)}`;
}

export async function fetchRouteGeometry(
    mode: RoutableMode,
    origin: GeoPoint,
    destination: GeoPoint,
    signal?: AbortSignal,
): Promise<RouteGeometry | null> {
    try {
        const payload = await treatyRequest(api.route.get({
            query: { mode, from: coordinates(origin), to: coordinates(destination) },
            fetch: { signal: withTimeout(signal) },
        }));
        if (payload.path.length < 2) {
            return null;
        }

        return {
            path: payload.path.map(([lon, lat], index) => ({
                lon,
                lat,
                label: index === 0 ? origin.label : index === payload.path.length - 1 ? destination.label : 'Tracé routier',
            })),
            distanceMeters: payload.distanceMeters,
            durationSeconds: payload.durationSeconds,
            instructions: payload.instructions,
        };
    } catch {
        return null;
    }
}

/**
 * Mesure plusieurs accès en une requête OSRM Table. Le résultat conserve
 * l'ordre des origines et destinations ; une cellule `null` est inaccessible.
 */
export async function fetchRouteMatrix(
    mode: RoutableMode,
    origins: GeoPoint[],
    destinations: GeoPoint[],
    signal?: AbortSignal,
): Promise<Array<Array<RouteMeasure | null>> | null> {
    try {
        const payload = await treatyRequest(
            api['route-matrix'].post({
                mode,
                origins: origins.map(({ lat, lon }) => ({ lat, lon })),
                destinations: destinations.map(({ lat, lon }) => ({ lat, lon })),
            }, { fetch: { signal: withTimeout(signal) } }),
        );
        return payload.measures.length === origins.length ? payload.measures : null;
    } catch {
        return null;
    }
}
