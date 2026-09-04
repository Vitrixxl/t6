// Traduction ligne SQL <-> objet du domaine. Isolée ici pour que les dépôts
// restent lisibles et que la forme des colonnes ne fuite nulle part ailleurs.
//
// Les lignes arrivent typées par Drizzle : plus de conversion de type, il ne
// reste que le passage du plat (origin_lat, origin_lon) à l'imbrique
// (origin: GeoPoint), que SQLite ne sait pas representer.
import type { GeoPoint, MobilityMode, SessionUser } from '../../../src/types.ts';
import type { users } from '../db/schema.ts';
import { mobilityProfile } from '../../../src/contracts';

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

export function toUserRow(row: UserRow | undefined): UserRow | null {
    // Les profils JSON historiques peuvent encore porter des réglages retirés.
    // Le contrat courant les élimine avant toute réponse ou export de compte.
    return row ? { ...row, profile: mobilityProfile.parse(row.profile) } : null;
}

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
    carbonSavedGrams: number | null;
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

export function toSessionUser(row: UserRow): SessionUser {
    return {
        id: row.id,
        email: row.email,
        displayName: row.displayName,
        profile: row.profile,
    };
}
