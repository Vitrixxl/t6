// Tests de la route de calcul d'itinéraire.
//
// Le calculateur est remplace par un `fetch` sous contrôle : la suite vérifie
// le comportement de l'API (validation, cache, indisponibilité), pas celui
// d'OSRM. Aucun appel réseau ne sort.
import { afterEach, describe, expect, it } from 'bun:test';
import { createTestApi, json, type ErrorBody } from './helpers.ts';
import { loadConfig } from '../config/index.ts';
import { fetchUpstreamMatrix, fetchUpstreamRoute } from '../services/routing/osrm.ts';
import type { RoutableMode } from '../../../src/types.ts';

const realFetch = globalThis.fetch;

interface RouteBody {
    path: [number, number][];
    distanceMeters: number;
    durationSeconds: number;
    source: 'cache' | 'upstream';
}

interface MatrixBody {
    measures: Array<Array<{
        distanceMeters: number;
        durationSeconds: number;
        source: 'cache' | 'upstream';
    } | null>>;
}

const OSRM_PAYLOAD = {
    code: 'Ok',
    routes: [
        {
            distance: 1200,
            duration: 300,
            geometry: {
                type: 'LineString',
                coordinates: [
                    [4.832, 45.7578],
                    [4.8594, 45.7606],
                ],
            },
            legs: [{ steps: [] }],
        },
    ],
};

/** Remplace le calculateur et compte les appels réellement sortis. */
function stubUpstream(response: (url: string) => Response): { calls: () => number } {
    let calls = 0;
    globalThis.fetch = (async (input: Parameters<typeof globalThis.fetch>[0]) => {
        calls += 1;
        return response(String(input));
    }) as unknown as typeof fetch;
    return { calls: () => calls };
}

function okResponse(): Response {
    return new Response(JSON.stringify(OSRM_PAYLOAD), { status: 200, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
    globalThis.fetch = realFetch;
});

const PATH = '/api/route?mode=bike&from=4.832,45.7578&to=4.8594,45.7606';

describe('adresses des moteurs OSRM', () => {
    const modes: Array<{ mode: RoutableMode; engine: 'foot' | 'bike' | 'car'; profile: string }> = [
        { mode: 'walk', engine: 'foot', profile: 'foot' },
        { mode: 'bike', engine: 'bike', profile: 'bike' },
        { mode: 'scooter', engine: 'bike', profile: 'bike' },
        { mode: 'car', engine: 'car', profile: 'driving' },
    ];

    for (const { mode, engine, profile } of modes) {
        it(`appelle directement le moteur ${engine} pour ${mode}, en route et en matrice`, async () => {
            const calls: string[] = [];
            stubUpstream((url) => {
                calls.push(url);
                return url.includes('/table/')
                    ? Response.json({ code: 'Ok', distances: [[1200]], durations: [[300]] })
                    : okResponse();
            });
            const urls = loadConfig({
                OSRM_FOOT_URL: 'http://osrm-foot:5000',
                OSRM_BIKE_URL: 'http://osrm-bike:5000',
                OSRM_CAR_URL: 'http://osrm-car:5000',
            }).osrmUrls;
            const from = { lon: 4.832, lat: 45.7578 };
            const to = { lon: 4.8594, lat: 45.7606 };
            expect(await fetchUpstreamRoute(urls, mode, from, to)).not.toBeNull();
            expect(await fetchUpstreamMatrix(urls, mode, [from], [to])).not.toBeNull();
            expect(calls[0]).toStartWith(`http://osrm-${engine}:5000/route/v1/${profile}/`);
            expect(calls[1]).toStartWith(`http://osrm-${engine}:5000/table/v1/${profile}/`);
            expect(new URL(calls[0]).searchParams.get('geometries')).toBe('geojson');
        });

        it(`conserve le préfixe public pour ${mode}`, async () => {
            const calls: string[] = [];
            stubUpstream((url) => {
                calls.push(url);
                return okResponse();
            });
            const point = { lon: 4.832, lat: 45.7578 };
            expect(await fetchUpstreamRoute(loadConfig({}).osrmUrls, mode, point, point)).not.toBeNull();
            expect(calls[0]).toStartWith(`https://routing.openstreetmap.de/routed-${engine}/route/v1/${profile}/`);
        });
    }
});

describe('GET /api/route', () => {
    it('renvoie le tracé, la distance et la durée du calculateur', async () => {
        stubUpstream((url) => {
            expect(new URL(url).searchParams.get('geometries')).toBe('geojson');
            return okResponse();
        });
        const api = createTestApi();

        const body = await json<RouteBody>(await api.call(PATH));

        expect(body.path).toHaveLength(2);
        expect(body.distanceMeters).toBe(1200);
        expect(body.durationSeconds).toBe(300);
        expect(body.source).toBe('upstream');
        api.close();
    });

    it("ne sollicite le calculateur qu'une fois pour un même trajet", async () => {
        const upstream = stubUpstream(okResponse);
        const api = createTestApi();

        await api.call(PATH);
        const second = await json<RouteBody>(await api.call(PATH));

        expect(upstream.calls()).toBe(1);
        expect(second.source).toBe('cache');
        api.close();
    });

    it('répond 503 quand le calculateur ne répond pas et qu’aucun tracé n’est connu', async () => {
        stubUpstream(() => {
            throw new Error('service injoignable');
        });
        const api = createTestApi();

        const response = await api.call(PATH);

        expect(response.status).toBe(503);
        expect((await json<ErrorBody>(response)).error).toContain('calculateur');
        api.close();
    });

    it('sert le tracé connu plutôt qu’une carte vide quand le calculateur tombe', async () => {
        let available = true;
        stubUpstream(() => {
            if (!available) {
                throw new Error('service injoignable');
            }
            return okResponse();
        });
        const api = createTestApi();

        await api.call(PATH);
        available = false;
        const body = await json<RouteBody>(await api.call(PATH));

        expect(body.source).toBe('cache');
        expect(body.distanceMeters).toBe(1200);
        api.close();
    });

    it('refuse des coordonnées mal formees sans appeler le calculateur', async () => {
        const upstream = stubUpstream(okResponse);
        const api = createTestApi();

        const response = await api.call('/api/route?mode=bike&from=Lyon&to=4.85,45.76');

        expect(response.status).toBe(422);
        expect(upstream.calls()).toBe(0);
        api.close();
    });

    // Verrouille B15 : le flux GBFS publie certaines stations Vélo'v avec treize
    // décimales. Une borne de précision les rejetait, et tout itinéraire passant
    // par l'une d'elles remontait au client comme un service indisponible.
    it('accepte la précision réelle des sources tierces', async () => {
        stubUpstream(okResponse);
        const api = createTestApi();

        const response = await api.call(
            '/api/route?mode=bike&from=4.8687553636982,45.7524835251712&to=4.85748756866509,45.7548502313005',
        );

        expect(response.status).toBe(200);
        api.close();
    });

    it('refuse un mode inconnu', async () => {
        stubUpstream(okResponse);
        const api = createTestApi();

        expect((await api.call('/api/route?mode=helicoptere&from=4.83,45.75&to=4.85,45.76')).status).toBe(422);
        api.close();
    });
});

describe('POST /api/route-matrix', () => {
    const body = {
        mode: 'walk',
        origins: [{ lat: 45.7578, lon: 4.832 }],
        destinations: [
            { lat: 45.7606, lon: 4.8594 },
            { lat: 45.761, lon: 4.86 },
        ],
    };

    const callMatrix = (api: ReturnType<typeof createTestApi>, input: typeof body = body) =>
        api.call('/api/route-matrix', {
            method: 'POST',
            body: input,
        });

    it('mesure tous les accès en une requête OSRM puis partage le cache', async () => {
        const upstream = stubUpstream((url) => {
            expect(url).toContain('http://osrm-foot:5000/table/v1/foot/');
            expect(url).toContain('annotations=distance%2Cduration');
            return new Response(
                JSON.stringify({
                    code: 'Ok',
                    distances: [[1200, 1450]],
                    durations: [[840, 960]],
                }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            );
        });
        const api = createTestApi();

        const firstResponse = await callMatrix(api);
        const secondResponse = await callMatrix(api);
        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        const first = await json<MatrixBody>(firstResponse);
        const second = await json<MatrixBody>(secondResponse);

        expect(first.measures[0]?.[0]).toEqual({
            distanceMeters: 1200,
            durationSeconds: 840,
            source: 'upstream',
        });
        expect(second.measures[0]?.[1]?.source).toBe('cache');
        expect(upstream.calls()).toBe(1);
        api.close();
    });

    it('borne la matrice agrégée a trente-deux points par axe', async () => {
        const upstream = stubUpstream(() => okResponse());
        const api = createTestApi();
        const tooMany = Array.from({ length: 33 }, (_, index) => ({ lat: 45.75, lon: 4.84 + index / 1000 }));

        const response = await callMatrix(api, { ...body, destinations: tooMany });

        expect(response.status).toBe(422);
        expect(upstream.calls()).toBe(0);
        api.close();
    });

    it('mesure la référence voiture avec driving et la ressort du cache partagé', async () => {
        const upstream = stubUpstream((url) => {
            expect(url).toContain('http://osrm-car:5000/table/v1/driving/');
            return new Response(
                JSON.stringify({ code: 'Ok', distances: [[3000]], durations: [[600]] }),
                { status: 200, headers: { 'content-type': 'application/json' } },
            );
        });
        const api = createTestApi();
        const carBody = {
            mode: 'car',
            origins: [body.origins[0]],
            destinations: [body.destinations[0]],
        };

        const first = await json<MatrixBody>(await callMatrix(api, carBody));
        const second = await json<MatrixBody>(await callMatrix(api, carBody));

        expect(first.measures[0]?.[0]?.distanceMeters).toBe(3000);
        expect(second.measures[0]?.[0]?.source).toBe('cache');
        expect(upstream.calls()).toBe(1);
        api.close();
    });
});
