import { afterEach, describe, expect, it, vi } from '../../test/harness';
import { fetchJson, loadTransportNetwork, mapDottVehicles, mergeVelovStations, weatherFromOpenMeteo } from './feeds';
import type { GtfsFeed } from '../../types';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('mergeVelovStations', () => {
    it('fusionne information et status GBFS v3 en stations exploitables', () => {
        const stations = mergeVelovStations(
            [
                {
                    station_id: '1001',
                    name: [
                        { text: 'BELLECOUR', language: 'fr' },
                        { text: 'BELLECOUR EN', language: 'en' },
                    ],
                    lat: 45.7578,
                    lon: 4.832,
                    capacity: 20,
                },
            ],
            [
                {
                    station_id: '1001',
                    num_vehicles_available: 7,
                    is_installed: true,
                    is_renting: true,
                    is_returning: true,
                    last_reported: '2026-09-14T08:00:00Z',
                },
            ],
        );

        expect(stations).toHaveLength(1);
        expect(stations[0].name).toBe("Vélo'v BELLECOUR");
        expect(stations[0].bikes_available).toBe(7);
        expect(stations[0].scooters_available).toBe(0);
        expect(stations[0].last_reported).toBe(Math.floor(Date.parse('2026-09-14T08:00:00Z') / 1000));
    });

    it('ecarte les stations hors périmètre urbain et sans status', () => {
        const stations = mergeVelovStations(
            [
                { station_id: 'far', name: 'LOIN', lat: 46.5, lon: 5.5, capacity: 10 },
                { station_id: 'no-status', name: 'SANS STATUS', lat: 45.7578, lon: 4.832, capacity: 10 },
            ],
            [],
        );

        expect(stations).toHaveLength(0);
    });
});

describe('mapDottVehicles', () => {
    it('convertit les trottinettes disponibles en points free-floating', () => {
        const stations = mapDottVehicles([
            {
                bike_id: 'v1',
                lat: 45.758,
                lon: 4.833,
                is_disabled: false,
                is_reserved: false,
                last_reported: 1789365900,
            },
            {
                bike_id: 'v2-reserved',
                lat: 45.758,
                lon: 4.833,
                is_disabled: false,
                is_reserved: true,
                last_reported: 1789365900,
            },
        ]);

        expect(stations).toHaveLength(1);
        expect(stations[0].station_id).toBe('dott-v1');
        expect(stations[0].scooters_available).toBe(1);
        expect(stations[0].bikes_available).toBe(0);
    });
});

describe('weatherFromOpenMeteo', () => {
    it('classe une pluie soutenue en heavy_rain', () => {
        const weather = weatherFromOpenMeteo({
            temperature_2m: 14.6,
            wind_speed_10m: 12,
            precipitation: 3.4,
            weather_code: 63,
            time: '2026-09-14T08:00',
        });

        expect(weather.condition).toBe('heavy_rain');
        expect(weather.temperature_celsius).toBe(15);
    });

    it('classe un ciel calme en clear et un vent fort en wind', () => {
        expect(
            weatherFromOpenMeteo({ temperature_2m: 21, wind_speed_10m: 8, precipitation: 0, weather_code: 1, time: 't' })
                .condition,
        ).toBe('clear');
        expect(
            weatherFromOpenMeteo({ temperature_2m: 21, wind_speed_10m: 42, precipitation: 0, weather_code: 1, time: 't' })
                .condition,
        ).toBe('wind');
    });

    it('classe une bruine sans cumul mesurable en light_rain via le code météo', () => {
        expect(
            weatherFromOpenMeteo({ temperature_2m: 12, wind_speed_10m: 10, precipitation: 0, weather_code: 51, time: 't' })
                .condition,
        ).toBe('light_rain');
    });
});

describe('mergeVélovStations - périmètre', () => {
    it('retient toutes les stations du périmètre, sans plafond d’affichage', () => {
        // Le nombre annonce dans l'interface doit être le nombre réellement
        // disponible : un plafond affiche comme une mesure serait un mensonge.
        const information = Array.from({ length: 560 }, (_, index) => ({
            station_id: `s${index}`,
            name: `STATION ${index}`,
            lat: 45.7578 + index * 0.0001,
            lon: 4.832,
            capacity: 20,
        }));
        const statuses = information.map((station) => ({
            station_id: station.station_id,
            num_vehicles_available: 3,
            is_installed: true,
            is_renting: true,
            is_returning: true,
            last_reported: 1789365900,
        }));

        expect(mergeVelovStations(information, statuses)).toHaveLength(560);
    });

    it('ecarte ce qui sort du périmètre métropolitain', () => {
        // Le rayon reste : c'est une decision de service, pas un plafond.
        const information = [
            { station_id: 'proche', name: 'PROCHE', lat: 45.7578, lon: 4.832, capacity: 20 },
            { station_id: 'loin', name: 'LOIN', lat: 46.5, lon: 4.832, capacity: 20 },
        ];
        const statuses = information.map((station) => ({
            station_id: station.station_id,
            num_vehicles_available: 3,
            is_installed: true,
            is_renting: true,
            is_returning: true,
            last_reported: 1789365900,
        }));

        const merged = mergeVelovStations(information, statuses);
        expect(merged).toHaveLength(1);
        expect(merged[0].name).toContain('PROCHE');
    });
});

const gtfsFixture: GtfsFeed = {
    agency: { agency_id: 'tcl', agency_name: 'TCL', agency_url: 'https://example.test', agency_timezone: 'Europe/Paris' },
    stops: [],
    routes: [],
    trips: [],
    weather: { condition: 'clear', temperature_celsius: 18, wind_kmh: 5, updated_at: 't' },
};

describe('fetchJson', () => {
    it('remonte une erreur explicite avec URL et statut si le flux répond en échec', async () => {
        vi.stubGlobal('fetch', async () => new Response(null, { status: 429 }));

        await expect(fetchJson('https://flux.test/gbfs.json')).rejects.toThrow(
            'Flux indisponible: https://flux.test/gbfs.json (429)',
        );
    });
});

describe('loadTransportNetwork', () => {
    it('signale les disponibilités absentes sans charger de secours quand le live échoue', async () => {
        const urls: string[] = [];
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            urls.push(String(input));
            const url = String(input);
            if (url.includes('gtfs-feed.json')) {
                return Response.json(gtfsFixture);
            }
            throw new Error('réseau coupe');
        });

        const network = await loadTransportNetwork();

        expect(network.sources?.gtfs).toBe('tcl-odbl');
        expect(network.sharedMobility).toBeNull();
        expect(urls.some((url) => url.includes("shared-mobility.json"))).toBe(false);
        expect(network.sources?.weather).toBe('local');
    });

    it('marque les sources live quand GBFS et Open-Meteo repondent', async () => {
        vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('gtfs-feed.json')) {
                return Response.json(gtfsFixture);
            }
            if (url.includes('station_information')) {
                return Response.json({
                    data: { stations: [{ station_id: '1001', name: 'BELLECOUR', lat: 45.7578, lon: 4.832, capacity: 20 }] },
                });
            }
            if (url.includes('station_status')) {
                return Response.json({
                    data: {
                        stations: [
                            {
                                station_id: '1001',
                                num_vehicles_available: 5,
                                is_installed: true,
                                is_renting: true,
                                is_returning: true,
                                last_reported: 1789365900,
                            },
                        ],
                    },
                });
            }
            if (url.includes('free_bike_status')) {
                return Response.json({ data: { bikes: [] } });
            }
            if (url.includes('open-meteo')) {
                return Response.json({
                    current: { temperature_2m: 19.4, wind_speed_10m: 9, precipitation: 0, weather_code: 1, time: 't' },
                });
            }
            throw new Error(`URL inattendue: ${url}`);
        });

        const network = await loadTransportNetwork();

        expect(network.sharedMobility).not.toBeNull();
        expect(network.sources?.weather).toBe('open-meteo');
        expect(network.sharedMobility?.data.stations[0].name).toBe("Vélo'v BELLECOUR");
        expect(network.gtfs.weather.temperature_celsius).toBe(19);
    });
});
