import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from './auth';
import { LANDMARKS, planRoutes } from './routePlanner';
import type { TransportNetwork } from '../types';

const network: TransportNetwork = {
  gtfs: {
    agency: {
      agency_id: 'test',
      agency_name: 'Test',
      agency_url: 'https://example.test',
      agency_timezone: 'Europe/Paris',
    },
    stops: [
      { stop_id: 'A', stop_name: 'Alpha', stop_lat: 45.75, stop_lon: 4.83, wheelchair_boarding: 1 },
      { stop_id: 'B', stop_name: 'Beta', stop_lat: 45.76, stop_lon: 4.86, wheelchair_boarding: 1 },
    ],
    routes: [
      {
        route_id: 'tram',
        route_short_name: 'T',
        route_long_name: 'Tram test',
        route_type: 0,
        route_color: '000000',
        route_text_color: 'ffffff',
      },
    ],
    trips: [
      {
        trip_id: 'tram-1',
        route_id: 'tram',
        service_id: 'weekday',
        headway_minutes: 5,
        realtime_delay_minutes: 0,
        occupancy: 'low',
      },
    ],
    incidents: [],
    weather: {
      condition: 'clear',
      temperature_celsius: 20,
      wind_kmh: 8,
      updated_at: '2026-09-14T08:00:00+02:00',
    },
  },
  sharedMobility: {
    last_updated: 1789365900,
    ttl: 60,
    version: '3.0',
    data: {
      stations: [
        {
          station_id: 's1',
          name: 'Station 1',
          lat: 45.751,
          lon: 4.831,
          capacity: 20,
          bikes_available: 8,
          scooters_available: 4,
          is_installed: true,
          is_renting: true,
          is_returning: true,
          last_reported: 1789365900,
        },
        {
          station_id: 's2',
          name: 'Station 2',
          lat: 45.759,
          lon: 4.858,
          capacity: 20,
          bikes_available: 3,
          scooters_available: 2,
          is_installed: true,
          is_renting: true,
          is_returning: true,
          last_reported: 1789365900,
        },
      ],
    },
  },
};

describe('planRoutes', () => {
  it('returns multimodal options ordered by score', () => {
    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: DEFAULT_PROFILE,
      network,
    });

    expect(routes.length).toBeGreaterThanOrEqual(3);
    expect(routes[0].score).toBeGreaterThanOrEqual(routes[1].score);
    expect(routes.some((route) => route.modes.includes('transit'))).toBe(true);
    expect(routes.some((route) => route.modes.includes('bike'))).toBe(true);
  });

  it('penalizes inaccessible options when PMR profile is enabled', () => {
    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: {
        ...DEFAULT_PROFILE,
        accessibilityNeed: true,
        preferredModes: ['bike', 'scooter'],
      },
      network,
    });

    const firstInaccessible = routes.find((route) => !route.accessible);
    const firstAccessible = routes.find((route) => route.accessible);

    expect(firstAccessible).toBeDefined();
    expect(firstInaccessible).toBeDefined();
    expect(firstAccessible?.score).toBeGreaterThan(firstInaccessible?.score ?? 0);
  });
});
