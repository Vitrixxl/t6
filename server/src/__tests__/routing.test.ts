// Tests de la route de calcul d'itinéraire.
//
// Le calculateur est remplace par un `fetch` sous contrôle : la suite vérifie
// le comportement de l'API (validation, cache, indisponibilité), pas celui
// d'OSRM. Aucun appel réseau ne sort.
import { afterEach, describe, expect, it } from 'bun:test';
import { openDatabase } from '../db/index.ts';
import { createRouteCacheRepository } from '../repositories/route-cache.ts';
import { createRoutingService } from '../services/routing/index.ts';
import { spyOn } from 'bun:test';
import { loadConfig } from '../config/index.ts';
import { fetchUpstreamMatrix, fetchUpstreamRoute } from '../services/routing/osrm.ts';
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
function setup() {
    const db = openDatabase(':memory:');
    return { db, routing: createRoutingService(loadConfig({}), createRouteCacheRepository(db)) };
}

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

        it(`utilise le moteur local par défaut pour ${mode}`, async () => {
            const calls: string[] = [];
            stubUpstream((url) => {
                calls.push(url);
                return okResponse();
            });
            const point = { lon: 4.832, lat: 45.7578 };
            expect(await fetchUpstreamRoute(loadConfig({}).osrmUrls, mode, point, point)).not.toBeNull();
            expect(calls[0]).toStartWith(`http://osrm-${engine}:5000/route/v1/${profile}/`);
        });
    }
});

describe('cache du service de routage', () => {
    it('mesure une géométrie réelle et réutilise le cache partagé', async () => {
        const upstream = stubUpstream(okResponse);
        const { db, routing } = setup();
        try {
            const first = await routing.route('bike', origin, destination);
            const second = await routing.route('bike', origin, destination);
            expect(first?.path).toHaveLength(2);
            expect(first?.distanceMeters).toBe(1200);
            expect(first?.durationSeconds).toBe(300);
            expect(first?.source).toBe('upstream');
            expect(second?.source).toBe('cache');
            expect(upstream.calls()).toBe(1);
        } finally { db.$client.close(); }
    });

    it('ne fabrique aucune géométrie en panne sans cache', async () => {
        const upstream = stubUpstream(() => { throw new Error('Panne OSRM'); });
        const { db, routing } = setup();
        try {
            expect(await routing.route('bike', origin, destination)).toBeNull();
            expect(upstream.calls()).toBe(1);
        } finally { db.$client.close(); }
    });

    it('réutilise une vraie mesure expirée si le moteur tombe', async () => {
        let available = true;
        const upstream = stubUpstream(() => {
            if (!available) throw new Error('Panne OSRM');
            return okResponse();
        });
        const { db, routing } = setup();
        const now = Date.now();
        const clock = spyOn(Date, 'now');
        try {
            clock.mockReturnValue(now);
            await routing.route('bike', origin, destination);
            available = false;
            clock.mockReturnValue(now + 25 * 3600_000);
            const fallback = await routing.route('bike', origin, destination);
            expect(fallback?.source).toBe('cache');
            expect(fallback?.distanceMeters).toBe(1200);
            expect(upstream.calls()).toBe(2);
        } finally { clock.mockRestore(); db.$client.close(); }
    });

    it('mesure les accès en matrice et partage leurs mesures', async () => {
        const upstream = stubUpstream(url => {
            expect(url).toContain('/table/v1/foot/');
            return Response.json({ code: 'Ok', distances: [[1200, 1450]], durations: [[840, 960]] });
        });
        const { db, routing } = setup();
        try {
            const destinations = [destination, { lat: 45.761, lon: 4.86 }];
            const first = await routing.matrix('walk', [origin], destinations);
            const second = await routing.matrix('walk', [origin], destinations);
            expect(first?.measures[0][0]).toEqual({ distanceMeters: 1200, durationSeconds: 840, source: 'upstream' });
            expect(second?.measures[0][1]?.source).toBe('cache');
            expect(upstream.calls()).toBe(1);
        } finally { db.$client.close(); }
    });

    it('mesure la référence voiture une fois avec driving', async () => {
        const upstream = stubUpstream(url => {
            expect(url).toContain('/table/v1/driving/');
            return Response.json({ code: 'Ok', distances: [[3000]], durations: [[600]] });
        });
        const { db, routing } = setup();
        try {
            expect((await routing.matrix('car', [origin], [destination]))?.measures[0][0]?.distanceMeters).toBe(3000);
            expect((await routing.matrix('car', [origin], [destination]))?.measures[0][0]?.source).toBe('cache');
            expect(upstream.calls()).toBe(1);
        } finally { db.$client.close(); }
    });
});
