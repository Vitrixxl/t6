// Tests de la route de calcul d'itineraire.
//
// Le calculateur est remplace par un `fetch` sous controle : la suite verifie
// le comportement de l'API (validation, cache, indisponibilite), pas celui
// d'OSRM. Aucun appel reseau ne sort.
import { afterEach, describe, expect, it } from 'bun:test';
import { createTestApi, json, type ErrorBody } from './helpers.ts';

const realFetch = globalThis.fetch;

interface RouteBody {
  path: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  source: 'cache' | 'upstream';
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

/** Remplace le calculateur et compte les appels reellement sortis. */
function stubUpstream(response: () => Response): { calls: () => number } {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return response();
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

describe('GET /api/route', () => {
  it('renvoie le trace, la distance et la duree du calculateur', async () => {
    stubUpstream(okResponse);
    const api = createTestApi();

    const body = await json<RouteBody>(await api.call(PATH));

    expect(body.path).toHaveLength(2);
    expect(body.distanceMeters).toBe(1200);
    expect(body.durationSeconds).toBe(300);
    expect(body.source).toBe('upstream');
    api.close();
  });

  it("ne sollicite le calculateur qu'une fois pour un meme trajet", async () => {
    const upstream = stubUpstream(okResponse);
    const api = createTestApi();

    await api.call(PATH);
    const second = await json<RouteBody>(await api.call(PATH));

    expect(upstream.calls()).toBe(1);
    expect(second.source).toBe('cache');
    api.close();
  });

  it('repond 503 quand le calculateur ne repond pas et qu aucun trace n est connu', async () => {
    stubUpstream(() => {
      throw new Error('service injoignable');
    });
    const api = createTestApi();

    const response = await api.call(PATH);

    expect(response.status).toBe(503);
    expect((await json<ErrorBody>(response)).error).toContain('calculateur');
    api.close();
  });

  it('sert le trace connu plutot qu une carte vide quand le calculateur tombe', async () => {
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

  it('refuse des coordonnees mal formees sans appeler le calculateur', async () => {
    const upstream = stubUpstream(okResponse);
    const api = createTestApi();

    const response = await api.call('/api/route?mode=bike&from=Lyon&to=4.85,45.76');

    expect(response.status).toBe(422);
    expect(upstream.calls()).toBe(0);
    api.close();
  });

  // Verrouille B15 : le flux GBFS publie certaines stations Velo'v avec treize
  // decimales. Une borne de precision les rejetait, et tout itineraire passant
  // par l'une d'elles remontait au client comme un service indisponible.
  it('accepte la precision reelle des sources tierces', async () => {
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
