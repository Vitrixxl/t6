// Tests des appels aux moteurs OSRM.
//
// Le calculateur est remplace par un `fetch` sous contrôle : la suite vérifie
// les adresses appelées et la lecture des réponses, pas le comportement
// d'OSRM. Aucun appel réseau ne sort.
import { afterEach, describe, expect, it } from 'bun:test';
import { loadConfig } from '../config/index.ts';
import { fetchOsrmMatrix, fetchOsrmRoute } from '../services/routing/osrm.ts';
import type { RoutableMode } from '../../../src/types.ts';

const realFetch = globalThis.fetch;

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

const origin = { lon: 4.832, lat: 45.7578 };
const destination = { lon: 4.8594, lat: 45.7606 };
const osrm = loadConfig({}).osrmUrls;

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
            expect(await fetchOsrmRoute(urls, mode, origin, destination)).not.toBeNull();
            expect(await fetchOsrmMatrix(urls, mode, [origin], [destination])).not.toBeNull();
            expect(calls[0]).toStartWith(`http://osrm-${engine}:5000/route/v1/${profile}/`);
            expect(calls[1]).toStartWith(`http://osrm-${engine}:5000/table/v1/${profile}/`);
            expect(new URL(calls[0]).searchParams.get('geometries')).toBe('geojson');
        });

        it(`utilise le moteur local par défaut pour ${mode}`, async () => {
            const calls: string[] = [];
            stubUpstream((url) => {
                calls.push(url);
                return okResponse();
            });
            expect(await fetchOsrmRoute(osrm, mode, origin, origin)).not.toBeNull();
            expect(calls[0]).toStartWith(`http://osrm-${engine}:5000/route/v1/${profile}/`);
        });
    }
});

describe('lecture des réponses OSRM', () => {
    it('reprend le tracé, la distance et la durée mesurés', async () => {
        const upstream = stubUpstream(okResponse);
        const geometry = await fetchOsrmRoute(osrm, 'bike', origin, destination);
        expect(geometry?.path).toHaveLength(2);
        expect(geometry?.distanceMeters).toBe(1200);
        expect(geometry?.durationSeconds).toBe(300);
        expect(upstream.calls()).toBe(1);
    });

    it('ne fabrique aucune géométrie quand le moteur tombe', async () => {
        const upstream = stubUpstream(() => { throw new Error('Panne OSRM'); });
        expect(await fetchOsrmRoute(osrm, 'bike', origin, destination)).toBeNull();
        expect(await fetchOsrmMatrix(osrm, 'walk', [origin], [destination])).toBeNull();
        expect(upstream.calls()).toBe(2);
    });

    it('mesure plusieurs accès en une matrice et signale un couple inaccessible par null', async () => {
        const upstream = stubUpstream(url => {
            expect(url).toContain('/table/v1/foot/');
            return Response.json({ code: 'Ok', distances: [[1200, null]], durations: [[840, null]] });
        });
        const measures = await fetchOsrmMatrix(osrm, 'walk', [origin], [destination, { lat: 45.761, lon: 4.86 }]);
        expect(measures?.[0]).toEqual([{ distanceMeters: 1200, durationSeconds: 840 }, null]);
        expect(upstream.calls()).toBe(1);
    });
});
