import type {
  GtfsFeed,
  NetworkSources,
  SharedMobilityFeed,
  SharedStation,
  TransportIncident,
  TransportNetwork,
  WeatherSignal,
} from '../types';

// Sources de donnees reelles (open data, sans cle API):
// - GTFS statique TCL/SYTRAL (licence ODbL) integre au build via scripts/fetch_gtfs.py.
// - GBFS v3 Velo'v (Cyclocity) et GBFS v2 Dott Lyon interroges en direct depuis le navigateur.
// - Meteo temps reel Open-Meteo.
// Les flux GTFS-RT/SIRI operateurs necessitent une cle: un fallback local simule les incidents.
const VELOV_INFO_URL = 'https://api.cyclocity.fr/contracts/lyon/gbfs/v3/station_information.json';
const VELOV_STATUS_URL = 'https://api.cyclocity.fr/contracts/lyon/gbfs/v3/station_status.json';
const DOTT_VEHICLES_URL = 'https://gbfs.api.ridedott.com/public/v2/lyon/free_bike_status.json';
const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=45.7578&longitude=4.832&current=temperature_2m,wind_speed_10m,precipitation,weather_code';

// Perimetre produit: toute la metropole de Lyon (Velo'v couvre Lyon/Villeurbanne,
// Dott et TCL debordent sur les communes limitrophes).
export const CITY_CENTER = { lat: 45.7578, lon: 4.832 };
export const METRO_RADIUS_KM = 16;
const STATION_RADIUS_KM = METRO_RADIUS_KM;
const MAX_VELOV_STATIONS = 500;
const MAX_DOTT_VEHICLES = 300;
const FETCH_TIMEOUT_MS = 8000;

interface VelovStationInformation {
  station_id: string;
  name: Array<{ text: string; language: string }> | string;
  lat: number;
  lon: number;
  capacity?: number;
}

interface VelovStationStatus {
  station_id: string;
  num_vehicles_available?: number;
  num_bikes_available?: number;
  num_docks_available?: number;
  is_installed: boolean;
  is_renting: boolean;
  is_returning: boolean;
  last_reported: string | number;
}

interface DottVehicle {
  bike_id: string;
  lat: number;
  lon: number;
  is_disabled: boolean;
  is_reserved: boolean;
  last_reported: number;
  vehicle_type_id?: string;
}

interface OpenMeteoCurrent {
  temperature_2m: number;
  wind_speed_10m: number;
  precipitation: number;
  weather_code: number;
  time: string;
}

export async function fetchJson<T>(url: string, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(url, {
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Flux indisponible: ${url} (${response.status})`);
  }

  return response.json() as Promise<T>;
}

function distanceToCenterKm(lat: number, lon: number): number {
  const earthRadiusKm = 6371;
  const dLat = ((lat - CITY_CENTER.lat) * Math.PI) / 180;
  const dLon = ((lon - CITY_CENTER.lon) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((CITY_CENTER.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}

function localizedName(name: VelovStationInformation['name']): string {
  if (typeof name === 'string') {
    return name;
  }
  const fr = name.find((entry) => entry.language === 'fr') ?? name[0];
  return fr ? fr.text : 'Station';
}

function toEpochSeconds(value: string | number): number {
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
    .sort(
      (a, b) => distanceToCenterKm(a.lat, a.lon) - distanceToCenterKm(b.lat, b.lon),
    )
    .slice(0, MAX_VELOV_STATIONS)
    .flatMap((station) => {
      const status = statusById.get(station.station_id);
      if (!status) {
        return [];
      }
      return [
        {
          station_id: `velov-${station.station_id}`,
          name: `Velo'v ${localizedName(station.name)}`,
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
    .sort((a, b) => distanceToCenterKm(a.lat, a.lon) - distanceToCenterKm(b.lat, b.lon))
    .slice(0, MAX_DOTT_VEHICLES)
    .map((vehicle) => ({
      station_id: `dott-${vehicle.bike_id}`,
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

export function weatherFromOpenMeteo(current: OpenMeteoCurrent): WeatherSignal {
  let condition: WeatherSignal['condition'] = 'clear';
  if (current.precipitation >= 2.5) {
    condition = 'heavy_rain';
  } else if (current.precipitation > 0 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(current.weather_code)) {
    condition = 'light_rain';
  } else if (current.wind_speed_10m >= 30) {
    condition = 'wind';
  }

  return {
    condition,
    temperature_celsius: Math.round(current.temperature_2m),
    wind_kmh: Math.round(current.wind_speed_10m),
    updated_at: current.time,
  };
}

async function fetchLiveSharedMobility(fetcher: typeof fetch): Promise<SharedMobilityFeed> {
  const [info, status, dott] = await Promise.all([
    fetchJson<{ data: { stations: VelovStationInformation[] } }>(VELOV_INFO_URL, fetcher),
    fetchJson<{ data: { stations: VelovStationStatus[] } }>(VELOV_STATUS_URL, fetcher),
    fetchJson<{ data: { bikes: DottVehicle[] } }>(DOTT_VEHICLES_URL, fetcher),
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

// --- Alertes trafic TCL (SIRI Situation Exchange via data.grandlyon.com) ----
// L'endpoint /api/tcl-alertes est un proxy du serveur (vite.config.ts) qui
// injecte les identifiants du compte Grand Lyon cote serveur. Sans compte
// configure, il repond 401 et les incidents simules du feed prennent le relais.

// Schema observe du flux tclalertetrafic_2 (extrait): titre, message, cause,
// type (Information/Perturbation...), mode (Metro/Tramway/Bus...), ligne_cli,
// ligne_com, typeseverite (effets type GTFS-RT: NO_SERVICE, OTHER_EFFECT...),
// niveauseverite (numerique), debut, fin ("YYYY-MM-DD HH:MM:SS").
interface TclAlertRecord {
  [key: string]: unknown;
}

function alertText(record: TclAlertRecord, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
}

function alertSeverity(record: TclAlertRecord): TransportIncident['severity'] {
  const effect = alertText(record, ['typeseverite']).toUpperCase();
  if (['NO_SERVICE', 'SIGNIFICANT_DELAYS', 'STOP_MOVED'].includes(effect)) {
    return 'high';
  }
  if (['REDUCED_SERVICE', 'DETOUR', 'MODIFIED_SERVICE'].includes(effect)) {
    return 'medium';
  }
  // Simple information (renfort d'offre, prolongation...) ou effet inconnu.
  return alertText(record, ['type']).toLowerCase() === 'information' ? 'low' : 'medium';
}

function alertStillActive(record: TclAlertRecord, now: Date): boolean {
  const end = alertText(record, ['fin']);
  if (!end) {
    return true;
  }
  const parsed = Date.parse(end.replace(' ', 'T'));
  return Number.isNaN(parsed) ? true : parsed >= now.getTime();
}

/** Convertit les enregistrements bruts du flux alertes TCL en incidents types. */
export function mapTclAlerts(
  payload: { values?: TclAlertRecord[] },
  now: Date = new Date(),
): TransportIncident[] {
  const records = payload.values ?? [];
  return records
    .filter((record) => alertStillActive(record, now))
    .map((record, index): TransportIncident | null => {
      const title = alertText(record, ['titre', 'cause', 'type']);
      const message = alertText(record, ['message']);
      if (!title && !message) {
        return null;
      }
      const line = alertText(record, ['ligne_com', 'ligne_cli']);
      const recordNumber = record.n;
      return {
        id: `tcl-alerte-${typeof recordNumber === 'number' || typeof recordNumber === 'string' ? recordNumber : index}`,
        severity: alertSeverity(record),
        // Le reseau TCL est du transport public quel que soit le sous-mode.
        affected_modes: ['transit'],
        title: line ? `${line} - ${title || 'Perturbation'}` : title || 'Perturbation TCL',
        message: message || title,
      };
    })
    .filter((incident): incident is TransportIncident => incident !== null)
    .slice(0, 40);
}

async function fetchTclIncidents(fetcher: typeof fetch): Promise<TransportIncident[]> {
  const payload = await fetchJson<{ values?: TclAlertRecord[] }>('/api/tcl-alertes', fetcher);
  const incidents = mapTclAlerts(payload);
  if (incidents.length === 0) {
    throw new Error('Flux alertes TCL vide.');
  }
  return incidents;
}

export async function loadTransportNetwork(fetcher: typeof fetch = fetch): Promise<TransportNetwork> {
  const gtfs = await fetchJson<GtfsFeed>('/data/gtfs-feed.json', fetcher);
  const sources: NetworkSources = {
    gtfs: gtfs.agency.agency_id === 'ufm-metropole' ? 'local' : 'tcl-odbl',
    sharedMobility: 'local',
    weather: 'local',
    incidents: 'local',
  };

  try {
    gtfs.incidents = await fetchTclIncidents(fetcher);
    sources.incidents = 'tcl-live';
  } catch {
    // Compte Grand Lyon absent ou flux indisponible: incidents simules du feed.
  }

  let sharedMobility: SharedMobilityFeed;
  try {
    sharedMobility = await fetchLiveSharedMobility(fetcher);
    sources.sharedMobility = 'gbfs-live';
  } catch {
    sharedMobility = await fetchJson<SharedMobilityFeed>('/data/shared-mobility.json', fetcher);
  }

  try {
    const meteo = await fetchJson<{ current: OpenMeteoCurrent }>(OPEN_METEO_URL, fetcher);
    gtfs.weather = weatherFromOpenMeteo(meteo.current);
    sources.weather = 'open-meteo';
  } catch {
    // Meteo locale du feed conservee.
  }

  return {
    gtfs,
    sharedMobility,
    sources,
  };
}

export function getFeedFreshness(feed: SharedMobilityFeed): string {
  const updatedAt = new Date(feed.last_updated * 1000);
  return updatedAt.toLocaleString('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
