import { afterEach, describe, expect, it, vi } from 'vitest';
import { enhanceRoutesWithLiveRouting, searchPlaces } from './index';
import type { RouteOption } from '../../types';

const origin = { label: 'Bellecour', lat: 45.7578, lon: 4.832 };
const destination = { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 };

function jsonResponse(payload: unknown): Response {
  return { ok: true, json: async () => payload } as Response;
}

// La recherche interroge deux geocodeurs: on route les stubs fetch par URL.
function stubGeocoders(banPayload: unknown, photonPayload: unknown = { features: [] }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) =>
      jsonResponse(String(url).includes('photon.komoot.io') ? photonPayload : banPayload),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchPlaces', () => {
  it('ne declenche aucun appel reseau sous 2 caracteres', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    expect(await searchPlaces(' a ')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('mappe la reponse GeoJSON de la BAN (coordonnees lon/lat) vers des resultats types', async () => {
    stubGeocoders({
      features: [
        {
          type: 'Feature',
          properties: { id: 'ban-1', label: 'Place Bellecour, Lyon', context: '69, Rhone', type: 'street' },
          geometry: { type: 'Point', coordinates: [4.832, 45.7578] },
        },
      ],
    });

    const results = await searchPlaces('Bellecour');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'ban-1',
      label: 'Place Bellecour, Lyon',
      lat: 45.7578,
      lon: 4.832,
      kind: 'Rue',
      source: 'api-adresse',
    });
  });

  it('ecarte les resultats hors metropole de Lyon (departement 69)', async () => {
    stubGeocoders({
      features: [
        {
          type: 'Feature',
          properties: { id: 'ban-69', label: 'Rue de la Part-Dieu, Lyon', context: '69, Rhone, Auvergne-Rhone-Alpes', type: 'street' },
          geometry: { type: 'Point', coordinates: [4.8594, 45.7606] },
        },
        {
          type: 'Feature',
          properties: { id: 'ban-976', label: 'Dzaoudzi', context: '976, Mayotte', type: 'municipality' },
          geometry: { type: 'Point', coordinates: [45.28, -12.78] },
        },
      ],
    });

    const results = await searchPlaces('part dieu');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('ban-69');
  });

  it('remonte les quartiers Photon en tete, types et bornes a la metropole', async () => {
    stubGeocoders(
      {
        features: [
          {
            type: 'Feature',
            properties: { id: 'ban-rue', label: 'Rue de la Part-Dieu, Lyon', context: '69, Rhone', type: 'street' },
            geometry: { type: 'Point', coordinates: [4.8523, 45.7616] },
          },
        ],
      },
      {
        features: [
          {
            type: 'Feature',
            properties: { osm_id: 42, osm_key: 'place', osm_value: 'suburb', type: 'district', name: 'La Part-Dieu', city: 'Lyon', postcode: '69003', countrycode: 'FR' },
            geometry: { type: 'Point', coordinates: [4.8563, 45.7621] },
          },
          {
            type: 'Feature',
            properties: { osm_id: 43, osm_key: 'place', osm_value: 'suburb', type: 'district', name: 'Hors zone', city: 'Paris', countrycode: 'FR' },
            geometry: { type: 'Point', coordinates: [2.35, 48.85] },
          },
        ],
      },
    );

    const results = await searchPlaces('part dieu');
    expect(results.map((item) => item.id)).toEqual(['osm-42', 'ban-rue']);
    expect(results[0]).toMatchObject({ label: 'La Part-Dieu', kind: 'Quartier', source: 'photon' });
  });

  it("retombe sur la BAN seule quand Photon est en echec", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) =>
        String(url).includes('photon.komoot.io')
          ? ({ ok: false, status: 502 } as Response)
          : jsonResponse({
              features: [
                {
                  type: 'Feature',
                  properties: { id: 'ban-1', label: 'Place Bellecour, Lyon', context: '69, Rhone', type: 'street' },
                  geometry: { type: 'Point', coordinates: [4.832, 45.7578] },
                },
              ],
            }),
      ),
    );

    const results = await searchPlaces('Bellecour');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('ban-1');
  });

  it('remonte une erreur explicite si les deux geocodeurs echouent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 }) as Response));

    await expect(searchPlaces('Bellecour')).rejects.toThrow(/indisponible \(503\)/);
  });
});

describe('enhanceRoutesWithLiveRouting', () => {
  const baseOption: RouteOption = {
    id: 'bike-transit',
    title: 'Velo + metro combine',
    summary: 'Test',
    modes: ['walk', 'bike', 'transit'],
    legs: [],
    path: [],
    distanceKm: 2,
    durationMinutes: 10,
    carbonGrams: 60, // intensite carbone mixte de 30 g/km (velo + metro)
    carbonSavedGrams: 300,
    reliabilityScore: 90,
    score: 80,
    accessible: true,
    warnings: [],
    instructions: [],
  };

  it('recale distance, duree et CO2 sur la geometrie routee en conservant l\'intensite carbone mixte', async () => {
    // Le client consomme desormais le contrat de notre API, pas la reponse
    // brute d'OSRM : le protocole du calculateur est entierement cote serveur.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          path: [
            [4.832, 45.7578],
            [4.8594, 45.7606],
          ],
          distanceMeters: 3000,
          durationSeconds: 900,
          instructions: [],
          source: 'upstream',
        }),
      ),
    );

    const [enhanced] = await enhanceRoutesWithLiveRouting([baseOption], origin, destination);

    expect(enhanced.distanceKm).toBe(3);
    expect(enhanced.durationMinutes).toBe(15);
    // 30 g/km x 3 km: le trajet mixte n'est pas regonfle au facteur du mode dominant.
    expect(enhanced.carbonGrams).toBe(90);
    expect(enhanced.carbonSavedGrams).toBe(3 * 180 - 90);
    expect(enhanced.path).toHaveLength(2);
    expect(enhanced.score).toBeLessThanOrEqual(baseOption.score);
  });

  it('conserve l\'option locale inchangee si le routage echoue (degradation gracieuse)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('reseau coupe');
      }),
    );

    const [enhanced] = await enhanceRoutesWithLiveRouting([baseOption], origin, destination);
    expect(enhanced).toEqual(baseOption);
  });
});
