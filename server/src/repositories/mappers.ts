// Traduction ligne SQL <-> objet du domaine. Isolee ici pour que les depots
// restent lisibles et que la forme des colonnes ne fuite nulle part ailleurs.
//
// Les lignes arrivent typees par Drizzle : plus de conversion de type, il ne
// reste que le passage du plat (origin_lat, origin_lon) a l'imbrique
// (origin: GeoPoint), que SQLite ne sait pas representer.
import type { GeoPoint, MobilityMode, SessionUser } from '../../../src/types.ts';
import type { users } from '../db/schema.ts';

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

interface EndpointRow {
  originLabel: string;
  originLat: number;
  originLon: number;
  destinationLabel: string;
  destinationLat: number;
  destinationLon: number;
}

interface MeasureRow {
  modes: MobilityMode[];
  distanceKm: number;
  durationMinutes: number;
  carbonGrams: number;
  carbonSavedGrams: number;
}

interface Endpoints {
  origin: GeoPoint;
  destination: GeoPoint;
}

export const endpoints = (row: EndpointRow): Endpoints => ({
  origin: { label: row.originLabel, lat: row.originLat, lon: row.originLon },
  destination: { label: row.destinationLabel, lat: row.destinationLat, lon: row.destinationLon },
});

export const flattenEndpoints = (input: Endpoints): EndpointRow => ({
  originLabel: input.origin.label,
  originLat: input.origin.lat,
  originLon: input.origin.lon,
  destinationLabel: input.destination.label,
  destinationLat: input.destination.lat,
  destinationLon: input.destination.lon,
});

export const measures = (row: MeasureRow): MeasureRow => ({
  modes: row.modes,
  distanceKm: row.distanceKm,
  durationMinutes: row.durationMinutes,
  carbonGrams: row.carbonGrams,
  carbonSavedGrams: row.carbonSavedGrams,
});

/**
 * Decoupe une liste pour l'insertion en bloc. SQLite borne le nombre de
 * parametres d'une requete ; cent lignes d'une vingtaine de colonnes restent
 * tres en dessous, quel que soit le build du moteur.
 */
export function chunks<T>(items: T[], size = 100): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    profile: row.profile,
  };
}
