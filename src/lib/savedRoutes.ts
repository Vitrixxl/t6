// Itinéraires enregistrés : création et projection pure dans la vue locale.
// La couche queries envoie ensuite seulement la ressource concernée.
import type { GeoPoint, RouteOption, SavedRouteRecord } from '../types';
import { SAVED_ROUTES_LIMIT } from '../contracts/limits';

export function createSavedRouteRecord(
    userId: string,
    origin: GeoPoint,
    destination: GeoPoint,
    option: RouteOption,
    now: Date = new Date(),
): SavedRouteRecord {
    return {
        id: stableSavedRouteId(origin, destination, option.id),
        userId,
        routeId: option.id,
        routeTitle: option.title,
        origin,
        destination,
        modes: option.modes,
        distanceKm: option.distanceKm,
        durationMinutes: option.durationMinutes,
        carbonGrams: option.carbonGrams,
        carbonSavedGrams: option.carbonSavedGrams,
        createdAt: now.toISOString(),
    };
}

/** Ajoute en tete ; le même trajet enregistre deux fois remplace sa version précédente. */
export function addSavedRoute(records: SavedRouteRecord[], record: SavedRouteRecord): SavedRouteRecord[] {
    return [record, ...records.filter((item) => item.id !== record.id)].slice(0, SAVED_ROUTES_LIMIT);
}

export function removeSavedRoute(records: SavedRouteRecord[], recordId: string): SavedRouteRecord[] {
    return records.filter((record) => record.id !== recordId);
}

/** Les coordonnées identifient les lieux ; leurs longs libellés n'ont pas à tenir dans l'identifiant HTTP. */
function stableSavedRouteId(origin: GeoPoint, destination: GeoPoint, routeId: string): string {
    return [
        routeId,
        origin.lat.toFixed(5),
        origin.lon.toFixed(5),
        destination.lat.toFixed(5),
        destination.lon.toFixed(5),
    ].join(':');
}
