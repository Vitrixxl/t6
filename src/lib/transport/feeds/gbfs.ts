// Vélos et trottinettes en libre-service (GBFS).
//
// Aucun plafond d'affichage : le nombre annonce dans l'interface est le nombre
// réellement disponible. Seul le périmètre métropolitain filtre les données,
// et c'est une decision de service, pas une limite technique.
//
// Deux sources aux formats différents : Vélo'v (GBFS v3, stations fixes, deux
// documents a fusionner) et Dott (GBFS v2.3, vehicules libres). Elles sont
// normalisées vers un même type SharedStation pour que la carte et le moteur
// n'aient qu'un modèle a connaître.
import type { SharedMobilityFeed, SharedStation } from '../../../types';
import { distanceToCenterKm, STATION_RADIUS_KM } from './area';
import { fetchJson } from './fetch-json';

export const VELOV_INFO_URL = 'https://api.cyclocity.fr/contracts/lyon/gbfs/v3/station_information.json';
export const VELOV_STATUS_URL = 'https://api.cyclocity.fr/contracts/lyon/gbfs/v3/station_status.json';
export const DOTT_VEHICLES_URL = 'https://gbfs.api.ridedott.com/public/v2/lyon/free_bike_status.json';

export interface VelovStationInformation {
    station_id: string;
    name: Array<{ text: string; language: string }> | string;
    lat: number;
    lon: number;
    capacity?: number;
}

export interface VelovStationStatus {
    station_id: string;
    num_vehicles_available?: number;
    num_bikes_available?: number;
    num_docks_available?: number;
    is_installed: boolean;
    is_renting: boolean;
    is_returning: boolean;
    last_reported: string | number;
}

export interface DottVehicle {
    bike_id: string;
    lat: number;
    lon: number;
    is_disabled: boolean;
    is_reserved: boolean;
    last_reported: number;
    vehicle_type_id?: string;
}

export function localizedName(name: VelovStationInformation['name']): string {
    if (typeof name === 'string') {
        return name;
    }
    const fr = name.find((entry) => entry.language === 'fr') ?? name[0];
    return fr ? fr.text : 'Station';
}

export function toEpochSeconds(value: string | number): number {
    if (typeof value === 'number') {
        return value;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Math.floor(Date.now() / 1000) : Math.floor(parsed / 1000);
}

export function mergeVelovStations(
    information: VelovStationInformation[],
    statuses: VelovStationStatus[],
): SharedStation[] {
    const statusById = new Map(statuses.map((status) => [status.station_id, status]));

    return information
        .filter((station) => distanceToCenterKm(station.lat, station.lon) <= STATION_RADIUS_KM)
        .flatMap((station) => {
            const status = statusById.get(station.station_id);
            if (!status) {
                return [];
            }
            return [
                {
                    station_id: `velov-${station.station_id}`,
                    kind: 'velov' as const,
                    name: `Vélo'v ${localizedName(station.name)}`,
                    lat: station.lat,
                    lon: station.lon,
                    capacity: station.capacity ?? 0,
                    bikes_available: status.num_vehicles_available ?? status.num_bikes_available ?? 0,
                    scooters_available: 0,
                    is_installed: status.is_installed,
                    is_renting: status.is_renting,
                    is_returning: status.is_returning,
                    last_reported: toEpochSeconds(status.last_reported),
                },
            ];
        });
}

export function mapDottVehicles(vehicles: DottVehicle[]): SharedStation[] {
    return vehicles
        .filter(
            (vehicle) =>
                !vehicle.is_disabled &&
                !vehicle.is_reserved &&
                distanceToCenterKm(vehicle.lat, vehicle.lon) <= STATION_RADIUS_KM,
        )
        .map((vehicle) => ({
            station_id: `dott-${vehicle.bike_id}`,
            kind: 'scooter' as const,
            name: 'Trottinette Dott',
            lat: vehicle.lat,
            lon: vehicle.lon,
            capacity: 1,
            bikes_available: 0,
            scooters_available: 1,
            is_installed: true,
            is_renting: true,
            is_returning: true,
            last_reported: vehicle.last_reported,
        }));
}

export async function fetchLiveSharedMobility(): Promise<SharedMobilityFeed> {
    const [info, status, dott] = await Promise.all([
        fetchJson<{ data: { stations: VelovStationInformation[] } }>(VELOV_INFO_URL),
        fetchJson<{ data: { stations: VelovStationStatus[] } }>(VELOV_STATUS_URL),
        fetchJson<{ data: { bikes: DottVehicle[] } }>(DOTT_VEHICLES_URL),
    ]);

    const stations = [
        ...mergeVelovStations(info.data.stations, status.data.stations),
        ...mapDottVehicles(dott.data.bikes),
    ];

    if (stations.length === 0) {
        throw new Error('GBFS live sans station exploitable.');
    }

    return {
        last_updated: Math.floor(Date.now() / 1000),
        ttl: 60,
        version: '2.3/3.0 live',
        data: { stations },
    };
}
