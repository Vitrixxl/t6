// Traduction ligne SQL <-> objet du domaine. Isolee ici pour que les depots
// restent lisibles et que la forme des colonnes ne fuite nulle part ailleurs.
import type { MobilityMode, SessionUser } from '../../../src/types.ts';

export type Row = Record<string, string | number | null>;

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  created_at: string;
  profile_json: string;
}

// Les modes sont stockes en JSON dans une colonne texte : la liste est courte,
// toujours lue en bloc, et jamais interrogee mode par mode. Une table de
// jointure serait ici du ceremonial sans benefice.
export const encodeModes = (modes: MobilityMode[]): string => JSON.stringify(modes);

export function decodeModes(raw: string): MobilityMode[] {
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? (parsed as MobilityMode[]) : [];
}

export const point = (row: Row, prefix: 'origin' | 'destination') => ({
  label: String(row[`${prefix}_label`]),
  lat: Number(row[`${prefix}_lat`]),
  lon: Number(row[`${prefix}_lon`]),
});

export const measures = (row: Row) => ({
  modes: decodeModes(String(row.modes)),
  distanceKm: Number(row.distance_km),
  durationMinutes: Number(row.duration_minutes),
  carbonGrams: Number(row.carbon_grams),
  carbonSavedGrams: Number(row.carbon_saved_grams),
});

export const nullableText = (value: string | number | null): string | null =>
  value === null ? null : String(value);

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    profile: JSON.parse(row.profile_json) as SessionUser['profile'],
  };
}
