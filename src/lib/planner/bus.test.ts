import { describe, expect, it } from 'bun:test';
import type { GtfsFeed, TransportNetwork } from '../../types';
import { findTransitJourney, transitLegs } from './transit';
import { transitEmissionFactor } from './emissions';
import { routeLabel } from './labels';

const feed: GtfsFeed = {
    agency: { agency_id: 'test', agency_name: 'Test', agency_url: '', agency_timezone: 'Europe/Paris' },
    stops: [
        { stop_id: 'a', stop_name: 'Départ', stop_lat: 45.75, stop_lon: 4.80, routes: ['bus:aller'], wheelchair_boarding: 1 },
        { stop_id: 'b', stop_name: 'Arrivée', stop_lat: 45.75, stop_lon: 4.84, routes: ['bus:aller'], wheelchair_boarding: 1 },
    ],
    routes: [{ route_id: 'bus:aller', route_short_name: 'C1', route_long_name: 'Départ - Arrivée', route_type: 3, route_color: '004F9F', route_text_color: 'FFFFFF', shape: [[4.80, 45.75], [4.82, 45.755], [4.84, 45.75]], stopSequence: ['a', 'b'], wheelchairAccessible: true }],
    trips: [{ trip_id: 'estimate', route_id: 'bus:aller', service_id: 'estimated', headway_minutes: 15, realtime_delay_minutes: 0, occupancy: 'medium' }],
    weather: { condition: 'clear', temperature_celsius: 20, wind_kmh: 0, updated_at: '' },
};
const network: TransportNetwork = { gtfs: feed, sharedMobility: null };
const departure = { label: 'Départ', lat: 45.75, lon: 4.80 };
const arrival = { label: 'Arrivée', lat: 45.75, lon: 4.84 };

describe('bus dans le moteur commun', () => {
    it('propose le bus desservant les deux quais avec son tracé et son facteur sourcé', () => {
        const journey = findTransitJourney(network, departure, arrival, false);
        expect(journey?.rides[0].route.route_id).toBe('bus:aller');
        expect(journey?.rides[0].path.some(point => point.lat === 45.755)).toBe(true);
        if (!journey) throw new Error('Desserte absente');
        const leg = transitLegs(journey, 'test')[0];
        expect(leg.mapLabel).toBe('Bus C1');
        expect(leg.carbonGrams).toBe(Math.round(leg.distanceKm * 122));
        expect(leg.durationMinutes).toBe(Math.round(leg.distanceKm / 15 * 60 + 8));
        expect(leg.detail).toContain('horaires non disponibles');
        expect(transitEmissionFactor(3).sourceUrl).toBe('https://impactco2.fr/outils/transport/busthermique');
    });

    it('ne retourne pas le tracé aller pour fabriquer un retour', () => {
        expect(findTransitJourney(network, arrival, departure, false)).toBeNull();
    });

    it('écarte un bus sans ordre des quais et un quai non accessible', () => {
        const missing = { ...feed, routes: feed.routes.map(route => ({ ...route, stopSequence: [] })) };
        expect(findTransitJourney({ ...network, gtfs: missing }, departure, arrival, false)).toBeNull();
        const inaccessibleBus = { ...feed, routes: feed.routes.map(route => ({ ...route, wheelchairAccessible: false })) };
        expect(findTransitJourney({ ...network, gtfs: inaccessibleBus }, departure, arrival, true)).toBeNull();
        const inaccessible: GtfsFeed = { ...feed, stops: feed.stops.map(stop => ({ ...stop, wheelchair_boarding: 2 })) };
        expect(findTransitJourney({ ...network, gtfs: inaccessible }, departure, arrival, true)).toBeNull();
    });

    it('conserve la distinction des libellés et des facteurs rail/bus', () => {
        expect(routeLabel({ ...feed.routes[0], route_type: 1 })).toBe('Métro C1');
        expect(transitEmissionFactor(1).gramsCo2ePerPassengerKm).toBe(4.2);
        const journey = findTransitJourney({ ...network, gtfs: { ...feed, routes: feed.routes.map(route => ({ ...route, wheelchairAccessible: false })) } }, departure, arrival, false);
        if (!journey) throw new Error('Bus absent');
        expect(transitLegs(journey, 'pmr')[0].accessible).toBe(false);
        expect(transitEmissionFactor(3).approximation).toContain('Motorisation non fournie');
    });
});
