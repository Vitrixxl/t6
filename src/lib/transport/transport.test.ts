import { afterEach, beforeEach, describe, expect, it, mock, spyOn, type Mock } from 'bun:test';
import { searchPlaces } from './index';


function jsonResponse(payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
    });
}

// La recherche interroge deux geocodeurs: on route les stubs fetch par URL.
function stubGeocoders(banPayload: unknown, photonPayload: unknown = { features: [] }) {
    fetchSpy.mockImplementation(async (url: RequestInfo | URL) =>
        jsonResponse(String(url).includes('photon.komoot.io') ? photonPayload : banPayload));
}

let fetchSpy: Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;

beforeEach(() => {
    fetchSpy = spyOn(globalThis, 'fetch');
    fetchSpy.mockRejectedValue(new Error('Appel réseau inattendu dans le test.'));
});

afterEach(() => {
    mock.restore();
});

describe('searchPlaces', () => {
    it('ne déclenche aucun appel réseau sous 2 caractères', async () => {
        expect(await searchPlaces(' a ')).toEqual([]);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('mappe la réponse GeoJSON de la BAN (coordonnées lon/lat) vers des résultats types', async () => {
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

    it('ecarte les résultats hors métropole de Lyon (departement 69)', async () => {
        stubGeocoders({
            features: [
                {
                    type: 'Feature',
                    properties: { id: 'ban-69', label: 'Rue de la Part-Dieu, Lyon', context: '69, Rhone, Auvergne-Rhône-Alpes', type: 'street' },
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

    it('remonte les quartiers Photon en tete, types et bornes à la métropole', async () => {
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

    it("retombe sur la BAN seule quand Photon est en échec", async () => {
        fetchSpy.mockImplementation(async (url: RequestInfo | URL) =>
            String(url).includes('photon.komoot.io')
                ? new Response(null, { status: 502 })
                : jsonResponse({
                    features: [
                        {
                            type: 'Feature',
                            properties: { id: 'ban-1', label: 'Place Bellecour, Lyon', context: '69, Rhone', type: 'street' },
                            geometry: { type: 'Point', coordinates: [4.832, 45.7578] },
                        },
                    ],
                }));

        const results = await searchPlaces('Bellecour');
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('ban-1');
    });

    it('remonte une erreur explicite si les deux geocodeurs echouent', async () => {
        fetchSpy.mockResolvedValue(new Response(null, { status: 503 }));

        await expect(searchPlaces('Bellecour')).rejects.toThrow(/indisponible \(503\)/);
    });
});
