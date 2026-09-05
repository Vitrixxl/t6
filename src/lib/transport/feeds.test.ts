import { afterEach, beforeEach, describe, expect, it, mock, spyOn, type Mock } from 'bun:test';
import { fetchJson, loadTransportNetwork, mapDottVehicles, mergeVelovStations } from './feeds';
import type { GtfsFeed } from '../../types';

let fetchSpy: Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;

beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch');
    fetchSpy.mockRejectedValue(new Error('Appel réseau inattendu dans le test.'));
});

afterEach(() => {
    mock.restore();
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
};

describe('fetchJson', () => {
    it('remonte une erreur explicite avec URL et statut si le flux répond en échec', async () => {
        fetchSpy.mockResolvedValue(new Response(null, { status: 429 }));

        await expect(fetchJson('https://flux.test/gbfs.json')).rejects.toThrow(
            'Flux indisponible: https://flux.test/gbfs.json (429)',
        );
    });
});

describe('loadTransportNetwork', () => {
    it('signale les disponibilités absentes sans charger de secours quand le live échoue', async () => {
        const urls: string[] = [];
        fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
            urls.push(String(input));
            const url = String(input);
            if (url.includes('gtfs-feed.json')) {
                return Response.json(gtfsFixture);
            }
            throw new Error('réseau coupe');
        });

        const network = await loadTransportNetwork(gtfsFixture);

        expect(network.sources?.gtfs).toBe('tcl-odbl');
        expect(network.sharedMobility).toBeNull();
        expect(urls.some((url) => url.includes("shared-mobility.json"))).toBe(false);
    });

    it('marque les sources live quand GBFS répond', async () => {
        fetchSpy.mockImplementation(async (input: RequestInfo | URL) => {
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
            throw new Error(`URL inattendue: ${url}`);
        });

        const network = await loadTransportNetwork(gtfsFixture);

        expect(network.sharedMobility).not.toBeNull();
        expect(network.sharedMobility?.data.stations[0].name).toBe("Vélo'v BELLECOUR");
    });
});
