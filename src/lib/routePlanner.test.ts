import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from './auth';
import { LANDMARKS, planRoutes, SCORING_WEIGHTS, totalWalkMinutes } from './routePlanner';
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
          // A ~40 m de Bellecour (LANDMARKS[0]) : dans le rayon de marche RG3 (400 m).
          station_id: 's1',
          name: 'Station 1',
          lat: 45.758,
          lon: 4.8325,
          capacity: 20,
          bikes_available: 8,
          scooters_available: 4,
          is_installed: true,
          is_renting: true,
          is_returning: true,
          last_reported: 1789365900,
        },
        {
          // A ~40 m de Part-Dieu (LANDMARKS[1]).
          station_id: 's2',
          name: 'Station 2',
          lat: 45.7605,
          lon: 4.859,
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

  it('applique un bonus de score aux modes preferes (poids centralises)', () => {
    const base = {
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      network,
    };
    const neutral = planRoutes({ ...base, profile: { ...DEFAULT_PROFILE, preferredModes: [] } });
    const bikeLover = planRoutes({ ...base, profile: { ...DEFAULT_PROFILE, preferredModes: ['bike'] } });

    const bikeNeutral = neutral.find((route) => route.modes.includes('bike'));
    const bikePreferred = bikeLover.find((route) => route.modes.includes('bike'));

    expect(bikeNeutral).toBeDefined();
    expect(bikePreferred).toBeDefined();
    // Le bonus par mode prefere est le coefficient centralise, pas une constante magique.
    expect(bikePreferred!.score).toBeGreaterThanOrEqual(bikeNeutral!.score + SCORING_WEIGHTS.preferenceBonusPerMode - 1);
  });

  it("RG5 : penalise et signale une option qui depasse la marche maximale du profil", () => {
    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: { ...DEFAULT_PROFILE, maxWalkMinutes: 1 },
      network,
    });

    const overWalking = routes.find((route) => totalWalkMinutes(route) > 1);
    expect(overWalking).toBeDefined();
    expect(overWalking!.warnings.some((warning) => /marche/i.test(warning))).toBe(true);
  });

  it('RG3 : aucune option velo/trottinette si aucune station n\'est a portee de marche', () => {
    const farStations: TransportNetwork = {
      ...network,
      sharedMobility: {
        ...network.sharedMobility,
        data: {
          stations: network.sharedMobility.data.stations.map((station) => ({
            ...station,
            lat: station.lat + 0.05, // ~5,5 km : hors du rayon RG3 de 400 m
          })),
        },
      },
    };

    const routes = planRoutes({
      origin: LANDMARKS[0],
      destination: LANDMARKS[1],
      profile: DEFAULT_PROFILE,
      network: farStations,
    });

    expect(routes.some((route) => route.modes.includes('bike') || route.modes.includes('scooter'))).toBe(false);
    // Le transport public reste disponible.
    expect(routes.some((route) => route.modes.includes('transit'))).toBe(true);
  });
});
