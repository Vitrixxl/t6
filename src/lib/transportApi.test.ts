import { describe, expect, it } from 'vitest';
import { mapDottVehicles, mergeVelovStations, weatherFromOpenMeteo } from './transportApi';

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
    expect(stations[0].name).toBe("Velo'v BELLECOUR");
    expect(stations[0].bikes_available).toBe(7);
    expect(stations[0].scooters_available).toBe(0);
    expect(stations[0].last_reported).toBe(Math.floor(Date.parse('2026-09-14T08:00:00Z') / 1000));
  });

  it('ecarte les stations hors perimetre urbain et sans status', () => {
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
});
