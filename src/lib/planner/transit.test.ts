// Tests du moteur de transport public.
//
// Ils verrouillent le correctif B12 : avant, la station de montee etait l'arret
// le plus proche quel qu'il soit (un arret de bus, le plus souvent) et la ligne
// affichee etait celle au passage le plus frequent du reseau, sans rapport avec
// le trajet. Les deux premiers cas ci-dessous echouent si cela revient.
import { describe, expect, it } from 'vitest';
import type { GtfsStop, TransportNetwork } from '../../types';
import { findTransitJourney } from './transit';
import { midpointOfPath, pathLengthKm, sliceShape } from './shape';

function stop(id: string, name: string, lat: number, lon: number, routes: string[]): GtfsStop {
  return { stop_id: id, stop_name: name, stop_lat: lat, stop_lon: lon, wheelchair_boarding: 1, routes };
}

// Deux lignes en croix. `nord` va du sud au nord, `est` de l'ouest a l'est, et
// elles se croisent a Hub. Aller de Sud a Est impose donc une correspondance.
const SUD = stop('sud', 'Sud', 45.74, 4.84, ['nord']);
const HUB = stop('hub', 'Hub', 45.76, 4.84, ['nord', 'est']);
const NORD = stop('nord', 'Nord', 45.78, 4.84, ['nord']);
const EST = stop('est', 'Est', 45.76, 4.88, ['est']);
const BUS = stop('bus', 'Arret de bus', 45.7401, 4.8401, []);

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
        shape: [
          [4.84, 45.74],
          [4.84, 45.76],
          [4.84, 45.78],
        ],
      },
      {
        route_id: 'est',
        route_short_name: 'T1',
        route_long_name: 'Hub - Est',
        route_type: 0,
        route_color: '004F9F',
        route_text_color: 'FFFFFF',
        shape: [
          [4.84, 45.76],
          [4.86, 45.76],
          [4.88, 45.76],
        ],
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

const at = (stopRecord: GtfsStop) => ({ label: stopRecord.stop_name, lat: stopRecord.stop_lat, lon: stopRecord.stop_lon });

describe('findTransitJourney', () => {
  it('ne fait jamais monter a un arret qu aucune ligne ne dessert', () => {
    // Le depart est a 10 m de l'arret de bus et a 2 km de la station Sud.
    const journey = findTransitJourney(network, { label: 'Depart', lat: 45.7402, lon: 4.8402 }, at(NORD), false);
    expect(journey?.rides[0].boarding.stop_id).toBe('sud');
  });

  it('nomme la ligne qui dessert reellement les deux stations', () => {
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

  it('suit le trace de la ligne, pas la ligne droite entre les stations', () => {
    const journey = findTransitJourney(network, at(SUD), at(NORD), false);
    // Le trace passe par le point intermediaire de Hub : trois points, pas deux.
    expect(journey?.rides[0].path.length).toBeGreaterThan(2);
  });

  it('ne renvoie rien si aucune station n est a portee de marche', () => {
    expect(findTransitJourney(network, { label: 'Loin', lat: 46.5, lon: 5.5 }, at(NORD), false)).toBeNull();
  });

  it('ecarte les stations non accessibles pour un profil PMR', () => {
    const inaccessible: TransportNetwork = {
      ...network,
      gtfs: { ...network.gtfs, stops: network.gtfs.stops.map((item) => ({ ...item, wheelchair_boarding: 2 as const })) },
    };
    expect(findTransitJourney(inaccessible, at(SUD), at(NORD), true)).toBeNull();
  });
});

describe('sliceShape', () => {
  const shape: [number, number][] = [
    [4.84, 45.74],
    [4.84, 45.76],
    [4.84, 45.78],
  ];

  it('extrait la portion entre deux stations', () => {
    const path = sliceShape(shape, SUD, HUB);
    expect(path?.[0].lat).toBeCloseTo(45.74, 4);
    expect(path?.[path.length - 1].lat).toBeCloseTo(45.76, 4);
  });

  it('retourne le trace quand on le remonte a contresens', () => {
    const path = sliceShape(shape, NORD, SUD);
    expect(path?.[0].lat).toBeCloseTo(45.78, 4);
    expect(path?.[path.length - 1].lat).toBeCloseTo(45.74, 4);
  });

  it('renvoie null quand la station n est pas sur le trace', () => {
    expect(sliceShape(shape, SUD, EST)).toBeNull();
  });
});

describe('pathLengthKm', () => {
  it('somme les segments plutot que la distance a vol d oiseau', () => {
    const detour = pathLengthKm([
      { label: 'a', lat: 45.75, lon: 4.83 },
      { label: 'b', lat: 45.76, lon: 4.83 },
      { label: 'c', lat: 45.75, lon: 4.83 },
    ]);
    expect(detour).toBeCloseTo(2.224, 2);
  });
});

describe('midpointOfPath', () => {
  const at = (lat: number, lon: number) => ({ label: 'p', lat, lon });

  // Verrouille le placement de l'etiquette de ligne. Elle etait posee au point
  // median de la liste : les sommets d'un trace publie etant denses dans les
  // courbes et rares sur les lignes droites, elle se retrouvait collee a une
  // extremite, par-dessus le repere de depart.
  it('mesure le milieu en longueur, pas en nombre de points', () => {
    // Neuf points serres sur les premieres dizaines de metres, puis 11 km droits.
    const dense = Array.from({ length: 9 }, (_, index) => at(45.75 + index * 0.0001, 4.85));
    const path = [...dense, at(45.85, 4.85)];

    const middle = midpointOfPath(path);
    const medianIndexPoint = path[Math.floor(path.length / 2)];

    expect(middle?.lat).toBeCloseTo(45.8004, 3);
    expect(middle?.lat).toBeGreaterThan(medianIndexPoint.lat);
  });

  it('tombe au centre d un trace regulier', () => {
    expect(midpointOfPath([at(45.75, 4.85), at(45.76, 4.85), at(45.77, 4.85)])?.lat).toBeCloseTo(45.76, 4);
  });

  it('rend le point unique d un trace degenere, et rien sur un trace vide', () => {
    expect(midpointOfPath([at(45.75, 4.85)])?.lat).toBe(45.75);
    expect(midpointOfPath([])).toBeNull();
  });
});
