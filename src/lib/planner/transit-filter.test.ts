import { expect, it } from 'bun:test';
import type { TransportNetwork } from '../../types';
import { filterTransitNetwork } from './transit-filter';
import { queryKeys } from '../../queries/keys';
import { DEFAULT_PROFILE } from '../../contracts';

const network: TransportNetwork = {
    gtfs: {
        agency: { agency_id: 'test', agency_name: 'Test', agency_url: '', agency_timezone: 'Europe/Paris' },
        routes: [1, 3].map(type => ({ route_id: String(type), route_type: type, route_short_name: String(type), route_long_name: '', route_color: '000000', route_text_color: 'FFFFFF', shape: [] })),
        stops: [
            { stop_id: 'bus', stop_name: 'Bus', stop_lat: 45.75, stop_lon: 4.83, wheelchair_boarding: 1, routes: ['3'] },
            { stop_id: 'hub', stop_name: 'Commun', stop_lat: 45.76, stop_lon: 4.84, wheelchair_boarding: 1, routes: ['1', '3'] },
        ],
        trips: [1, 3].map(type => ({ trip_id: String(type), route_id: String(type), service_id: 'test', headway_minutes: 10, realtime_delay_minutes: 0, occupancy: 'low' })),
        weather: { condition: 'clear', temperature_celsius: 20, wind_kmh: 0, updated_at: '' },
    },
    sharedMobility: null,
};

it('retire le bus avant la sélection des quais et des correspondances', () => {
    const filtered = filterTransitNetwork(network, [1]);
    expect(filtered.gtfs.routes.map(route => route.route_id)).toEqual(['1']);
    expect(filtered.gtfs.stops).toHaveLength(1);
    expect(filtered.gtfs.stops[0].routes).toEqual(['1']);
    expect(filtered.gtfs.trips.map(trip => trip.route_id)).toEqual(['1']);
    expect(network.gtfs.stops[1].routes).toEqual(['1', '3']);
});

it('autorise plusieurs types ou aucun sans modifier les autres ressources', () => {
    expect(filterTransitNetwork(network, [3, 1]).gtfs.routes).toHaveLength(2);
    const empty = filterTransitNetwork(network, []);
    expect(empty.gtfs.routes).toEqual([]);
    expect(empty.gtfs.stops).toEqual([]);
    expect(empty.gtfs.trips).toEqual([]);
    expect(empty.sharedMobility).toBe(network.sharedMobility);
    expect(empty.gtfs.weather).toBe(network.gtfs.weather);
});

it('isole les résultats du cache selon les types autorisés', () => {
    const point = { label: 'Test', lat: 45.75, lon: 4.83 };
    expect(queryKeys.measuredRoutes(point, point, DEFAULT_PROFILE, [3]))
        .not.toEqual(queryKeys.measuredRoutes(point, point, DEFAULT_PROFILE, [1]));
});
