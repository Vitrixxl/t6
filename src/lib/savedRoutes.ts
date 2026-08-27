import type { GeoPoint, RouteOption, SavedRouteRecord } from '../types';
import { enqueueOperation } from './api/outbox';

const SAVED_ROUTES_PREFIX = 'ufm.savedRoutes.';
const SAVED_ROUTES_LIMIT = 50;

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
    score: option.score,
    createdAt: now.toISOString(),
  };
}

export function loadSavedRoutes(userId: string): SavedRouteRecord[] {
  const payload = localStorage.getItem(storageKey(userId));
  if (!payload) {
    return [];
  }

  try {
    const records = JSON.parse(payload) as SavedRouteRecord[];
    return Array.isArray(records) ? records.slice(0, SAVED_ROUTES_LIMIT) : [];
  } catch {
    localStorage.removeItem(storageKey(userId));
    return [];
  }
}

export function saveSavedRouteRecord(record: SavedRouteRecord): SavedRouteRecord[] {
  const records = [record, ...loadSavedRoutes(record.userId).filter((item) => item.id !== record.id)].slice(0, SAVED_ROUTES_LIMIT);
  localStorage.setItem(storageKey(record.userId), JSON.stringify(records));
  const { userId, ...payload } = record;
  enqueueOperation(userId, { kind: 'saved.upsert', record: payload });
  return records;
}

export function deleteSavedRouteRecord(userId: string, routeRecordId: string): SavedRouteRecord[] {
  const records = loadSavedRoutes(userId).filter((record) => record.id !== routeRecordId);
  localStorage.setItem(storageKey(userId), JSON.stringify(records));
  enqueueOperation(userId, { kind: 'saved.delete', recordId: routeRecordId });
  return records;
}

/** Remplace le cache local par l'etat du serveur (hydratation apres connexion). */
export function replaceSavedRoutes(userId: string, records: SavedRouteRecord[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(records.slice(0, SAVED_ROUTES_LIMIT)));
}

function stableSavedRouteId(origin: GeoPoint, destination: GeoPoint, routeId: string): string {
  return [
    routeId,
    origin.label,
    origin.lat.toFixed(5),
    origin.lon.toFixed(5),
    destination.label,
    destination.lat.toFixed(5),
    destination.lon.toFixed(5),
  ].join(':');
}

function storageKey(userId: string): string {
  return `${SAVED_ROUTES_PREFIX}${userId}`;
}
