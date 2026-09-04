import { describe, expect, it } from '../../test/harness';
import { DEFAULT_PROFILE } from '../../contracts';
import type { GeoPoint, RouteMeasure, TransportNetwork } from '../../types';
import { prepareRoutedAccessPlan } from './access';
import { planRoutes } from './index';

const origin: GeoPoint = { label: 'Départ', lat: 45.75, lon: 4.84 };
const destination: GeoPoint = { label: 'Arrivée', lat: 45.755, lon: 4.845 };

const network: TransportNetwork = {
    gtfs: {
        agency: {
            agency_id: 'test',
            agency_name: 'Test',
            agency_url: 'https://example.test',
            agency_timezone: 'Europe/Paris',
        },
        stops: [],
        routes: [],
        trips: [],
        weather: {
            condition: 'clear',
            temperature_celsius: 20,
            wind_kmh: 5,
            updated_at: '2026-09-04T08:00:00+02:00',
        },
    },
    sharedMobility: {
        last_updated: 1788508800,
        ttl: 60,
        version: '3.0',
        data: {
            stations: [
                {
                    station_id: 'proche-bloquée',
                    kind: 'velov',
                    name: 'Proche mais contournee',
                    lat: 45.7501,
                    lon: 4.8401,
                    capacity: 20,
                    bikes_available: 8,
                    scooters_available: 0,
                    is_installed: true,
                    is_renting: true,
                    is_returning: true,
                    last_reported: 1788508800,
                },
                {
                    station_id: 'rapide',
                    kind: 'velov',
                    name: 'Un peu plus loin mais rapide',
                    lat: 45.7508,
                    lon: 4.8408,
                    capacity: 20,
                    bikes_available: 5,
                    scooters_available: 0,
                    is_installed: true,
                    is_renting: true,
                    is_returning: true,
                    last_reported: 1788508800,
                },
                {
                    station_id: 'arrivee',
                    kind: 'velov',
                    name: 'Retour arrivée',
                    lat: 45.7551,
                    lon: 4.8451,
                    capacity: 20,
                    bikes_available: 0,
                    scooters_available: 0,
                    is_installed: true,
                    is_renting: false,
                    is_returning: true,
                    last_reported: 1788508800,
                },
            ],
        },
    },
};

function routedMeasure(_from: GeoPoint, to: GeoPoint): RouteMeasure {
    const slow = to.label === 'Proche mais contournee';
    return {
        distanceMeters: slow ? 390 : 120,
        durationSeconds: slow ? 720 : 110,
        source: 'upstream',
    };
}

describe('prepareRoutedAccessPlan', () => {
    it('retient la station la plus rapide à pied, pas la plus proche à vol d’oiseau', async () => {
        const calls: Array<{ mode: string; origins: number; destinations: number }> = [];
        const access = await prepareRoutedAccessPlan(
            { origin, destination, network, requireAccessible: false },
            async (mode, origins, destinations) => {
                calls.push({ mode, origins: origins.length, destinations: destinations.length });
                return origins.map((from) => destinations.map((to) => routedMeasure(from, to)));
            },
        );

        expect(calls).toEqual([
            { mode: 'walk', origins: 1, destinations: 2 },
            { mode: 'walk', origins: 1, destinations: 1 },
        ]);
        expect(access.bike?.pickup.station.station_id).toBe('rapide');
        expect(access.bike?.pickup.measure.durationMinutes).toBeCloseTo(110 / 60, 5);

        const bike = planRoutes({ origin, destination, profile: DEFAULT_PROFILE, network }, access)
            .find((route) => route.id === 'bike');
        expect(bike?.legs[0].toPoint.label).toBe('Un peu plus loin mais rapide');
        expect(bike?.legs[0].durationMinutes).toBe(2);
    });
});
