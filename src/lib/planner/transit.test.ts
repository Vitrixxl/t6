import { describe, expect, it } from 'bun:test';
import type { GtfsRoute, GtfsStop, TransportNetwork } from '../../types';
import { findTransitJourney, transitLegs, type TransitJourney } from './transit';
import { midpointOfPath, pathLengthKm, sliceShape } from './shape';

function stop(id: string, name: string, lat: number, lon: number, routes: string[]): GtfsStop {
    return { stop_id: id, stop_name: name, stop_lat: lat, stop_lon: lon, wheelchair_boarding: 1, routes };
}

// Deux lignes en croix. `nord` va du sud au nord, `est` de l'ouest à l'est, et
// elles se croisent a Hub. Aller de Sud a Est impose donc une correspondance.
const SUD = stop('sud', 'Sud', 45.74, 4.84, ['nord']);
const HUB = stop('hub', 'Hub', 45.76, 4.84, ['nord', 'est']);
const NORD = stop('nord', 'Nord', 45.78, 4.84, ['nord']);
const EST = stop('est', 'Est', 45.76, 4.88, ['est']);
const BUS = stop('bus', 'Arrêt de bus', 45.7401, 4.8401, []);

const network: TransportNetwork = {
    gtfs: {
        agency: { agency_id: 't', agency_name: 'T', agency_url: 'https://example.test', agency_timezone: 'Europe/Paris' },
        stops: [SUD, HUB, NORD, EST, BUS],
        routes: [
            {
                route_id: 'nord',
                route_short_name: 'A',
                route_long_name: 'Sud - Nord',
                route_type: 1,
                route_color: 'E8308A',
                route_text_color: 'FFFFFF',
                shape: [[4.84, 45.74], [4.84, 45.76], [4.84, 45.78]],
            },
            {
                route_id: 'est',
                route_short_name: 'T1',
                route_long_name: 'Hub - Est',
                route_type: 0,
                route_color: '004F9F',
                route_text_color: 'FFFFFF',
                shape: [[4.84, 45.76], [4.86, 45.76], [4.88, 45.76]],
            },
        ],
        trips: [
            { trip_id: 'nord-1', route_id: 'nord', service_id: 'weekday', headway_minutes: 4, realtime_delay_minutes: 0, occupancy: 'low' },
            { trip_id: 'est-1', route_id: 'est', service_id: 'weekday', headway_minutes: 8, realtime_delay_minutes: 0, occupancy: 'low' },
        ],
        weather: { condition: 'clear', temperature_celsius: 20, wind_kmh: 8, updated_at: '2026-09-14T08:00:00+02:00' },
    },
    sharedMobility: { last_updated: 0, ttl: 60, version: '3.0', data: { stations: [] } },
};

const at = (record: GtfsStop) => ({ label: record.stop_name, lat: record.stop_lat, lon: record.stop_lon });

describe('findTransitJourney', () => {
    it('ne fait jamais monter à un arrêt qu’aucune ligne ne dessert', () => {
        const journey = findTransitJourney(network, { label: 'Départ', lat: 45.7402, lon: 4.8402 }, at(NORD), false);
        expect(journey?.rides[0].boarding.stop_id).toBe('sud');
    });

    it('nomme la ligne qui dessert réellement les deux stations', () => {
        const journey = findTransitJourney(network, at(SUD), at(NORD), false);
        expect(journey?.rides).toHaveLength(1);
        expect(journey?.rides[0].route.route_short_name).toBe('A');
    });

    it('enchaine deux lignes par une station commune quand aucune ne va directement', () => {
        const journey = findTransitJourney(network, at(SUD), at(EST), false);
        expect(journey?.rides.map((ride) => ride.route.route_short_name)).toEqual(['A', 'T1']);
        expect(journey?.rides[0].alighting.stop_id).toBe('hub');
        expect(journey?.rides[1].boarding.stop_id).toBe('hub');
    });

    it('suit le tracé de la ligne, pas la ligne droite entre les stations', () => {
        const journey = findTransitJourney(network, at(SUD), at(NORD), false);
        expect(journey?.rides[0].path.length).toBeGreaterThan(2);
    });

    it('ne renvoie rien si aucune station n’est à portée de marche', () => {
        expect(findTransitJourney(network, { label: 'Loin', lat: 46.5, lon: 5.5 }, at(NORD), false)).toBeNull();
    });

    it('ecarte les stations non accessibles pour un profil PMR', () => {
        const inaccessible: TransportNetwork = {
            ...network,
            gtfs: {
                ...network.gtfs,
                stops: network.gtfs.stops.map((item): GtfsStop => ({ ...item, wheelchair_boarding: 2 })),
            },
        };
        expect(findTransitJourney(inaccessible, at(SUD), at(NORD), true)).toBeNull();
    });
});

describe('sliceShape', () => {
    const shape: [number, number][] = [[4.84, 45.74], [4.84, 45.76], [4.84, 45.78]];

    it('extrait la portion entre deux stations', () => {
        const path = sliceShape(shape, SUD, HUB);
        expect(path?.[0].lat).toBeCloseTo(45.74, 4);
        expect(path?.[path.length - 1].lat).toBeCloseTo(45.76, 4);
    });

    it('retourne le tracé quand on le remonte a contresens', () => {
        const path = sliceShape(shape, NORD, SUD);
        expect(path?.[0].lat).toBeCloseTo(45.78, 4);
        expect(path?.[path.length - 1].lat).toBeCloseTo(45.74, 4);
    });

    it('renvoie null quand la station n’est pas sur le tracé', () => {
        expect(sliceShape(shape, SUD, EST)).toBeNull();
    });
});

describe('pathLengthKm', () => {
    it('somme les segments plutôt que la distance à vol d’oiseau', () => {
        const detour = pathLengthKm([
            { label: 'a', lat: 45.75, lon: 4.83 },
            { label: 'b', lat: 45.76, lon: 4.83 },
            { label: 'c', lat: 45.75, lon: 4.83 },
        ]);
        expect(detour).toBeCloseTo(2.224, 2);
    });
});

describe('midpointOfPath', () => {
    const point = (lat: number, lon: number) => ({ label: 'p', lat, lon });

    it('mesure le milieu en longueur, pas en nombre de points', () => {
        const dense = Array.from({ length: 9 }, (_, index) => point(45.75 + index * 0.0001, 4.85));
        const path = [...dense, point(45.85, 4.85)];
        const middle = midpointOfPath(path);
        const medianIndexPoint = path[Math.floor(path.length / 2)];

        expect(middle?.lat).toBeCloseTo(45.8004, 3);
        expect(middle?.lat).toBeGreaterThan(medianIndexPoint.lat);
    });

    it('tombe au centre d’un tracé régulier', () => {
        expect(midpointOfPath([point(45.75, 4.85), point(45.76, 4.85), point(45.77, 4.85)])?.lat).toBeCloseTo(45.76, 4);
    });

    it('rend le point unique d’un tracé degenere, et rien sur un tracé vide', () => {
        expect(midpointOfPath([point(45.75, 4.85)])?.lat).toBe(45.75);
        expect(midpointOfPath([])).toBeNull();
    });
});

const interchange: GtfsStop = {
    stop_id: 'charpennes',
    stop_name: 'Charpennes Charles Hernu',
    stop_lat: 45.7707,
    stop_lon: 4.8631,
    wheelchair_boarding: 1,
    routes: ['metro-a', 'metro-b'],
};

const routeA: GtfsRoute = {
    route_id: 'metro-a',
    route_short_name: 'A',
    route_long_name: 'Métro A',
    route_type: 1,
    route_color: 'EE3898',
    route_text_color: 'FFFFFF',
    shape: [],
};

const routeB: GtfsRoute = {
    route_id: 'metro-b',
    route_short_name: 'B',
    route_long_name: 'Métro B',
    route_type: 1,
    route_color: '0074C8',
    route_text_color: 'FFFFFF',
    shape: [],
};

describe('transitLegs', () => {
    it('matérialise la correspondance entre deux lignes comme une étape à pied', () => {
        const journey: TransitJourney = {
            rides: [
                {
                    route: routeA,
                    boarding: { ...interchange, stop_id: 'republique', stop_name: 'Republique Villeurbanne', routes: ['metro-a'] },
                    alighting: interchange,
                    path: [
                        { label: 'Republique Villeurbanne', lat: 45.7668, lon: 4.8721 },
                        { label: interchange.stop_name, lat: interchange.stop_lat, lon: interchange.stop_lon },
                    ],
                    distanceKm: 1.2,
                    waitMinutes: 2,
                },
                {
                    route: routeB,
                    boarding: interchange,
                    alighting: { ...interchange, stop_id: 'guichard', stop_name: 'Place Guichard', routes: ['metro-b'] },
                    path: [
                        { label: interchange.stop_name, lat: interchange.stop_lat, lon: interchange.stop_lon },
                        { label: 'Place Guichard', lat: 45.7595, lon: 4.8476 },
                    ],
                    distanceKm: 1.8,
                    waitMinutes: 2,
                },
            ],
            departureAccess: { distanceKm: 0.2, durationMinutes: 3 },
            arrivalAccess: { distanceKm: 0.3, durationMinutes: 4 },
            totalMinutes: 20,
        };

        const legs = transitLegs(journey, 'transit');

        expect(legs.map((leg) => leg.mode)).toEqual(['transit', 'walk', 'transit']);
        expect(legs[1]).toMatchObject({
            title: 'Correspondance à pied',
            from: 'Quai Métro A',
            to: 'Quai Métro B',
            durationMinutes: 4,
            distanceKm: 0,
            path: [],
            transfer: true,
        });
    });
});
