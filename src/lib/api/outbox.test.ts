import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { discardOperations, enqueueOperation, flushOutbox, pendingOperationCount } from './outbox';
import { markApiOffline, probeApi } from './availability';

const USER = 'user-1';
const OTHER_USER = 'user-2';

const RECORD = {
  id: 'trip-1',
  routeTitle: 'Velo + metro',
  modes: ['bike', 'transit'] as const,
  distanceKm: 5.2,
  durationMinutes: 22,
  carbonGrams: 136,
  carbonSavedGrams: 900,
  createdAt: '2026-09-01T08:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Rend l'API "joignable" pour la sonde, sans reseau reel. */
async function goOnline(): Promise<void> {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ status: 'ok' }));
  await probeApi();
}

beforeEach(() => {
  markApiOffline();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("file d'attente de synchronisation", () => {
  it('empile les operations sans reseau et ne tente rien hors ligne', async () => {
    enqueueOperation(USER, { kind: 'trip.record', record: { ...RECORD, modes: [...RECORD.modes] } });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await flushOutbox(USER);

    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    // Rien n'est perdu : l'operation attend le retour du reseau.
    expect(pendingOperationCount(USER)).toBe(1);
  });

  it('vide la file quand le serveur accepte le lot', async () => {
    await goOnline();
    enqueueOperation(USER, { kind: 'trip.record', record: { ...RECORD, modes: [...RECORD.modes] } });
    enqueueOperation(USER, { kind: 'trip.history.clear' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ applied: 2, ignored: 0 }));

    const result = await flushOutbox(USER);

    expect(result).toMatchObject({ applied: 2, ignored: 0, remaining: 0 });
    expect(pendingOperationCount(USER)).toBe(0);
  });

  it('conserve la file si le reseau tombe pendant l envoi', async () => {
    await goOnline();
    enqueueOperation(USER, { kind: 'trip.history.clear' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await flushOutbox(USER);

    expect(result).toMatchObject({ applied: 0, remaining: 1 });
    expect(pendingOperationCount(USER)).toBe(1);
  });

  it('ecarte un lot refuse par la validation serveur pour ne pas bloquer la file', async () => {
    await goOnline();
    enqueueOperation(USER, { kind: 'planned.delete', tripId: 'inconnu' });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'Requete invalide.' }, 400));

    const result = await flushOutbox(USER);

    expect(result).toMatchObject({ remaining: 0 });
    expect(pendingOperationCount(USER)).toBe(0);
  });

  it('garde la file intacte quand la session a expire', async () => {
    await goOnline();
    enqueueOperation(USER, { kind: 'planned.delete', tripId: 'trip-1' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'Session expiree.' }, 401));

    const result = await flushOutbox(USER);

    // La reconnexion rejouera l'operation : on ne la perd pas.
    expect(result).toMatchObject({ applied: 0, remaining: 1 });
    expect(pendingOperationCount(USER)).toBe(1);
  });

  it("n'envoie jamais les operations d'un autre compte", async () => {
    await goOnline();
    enqueueOperation(OTHER_USER, { kind: 'trip.history.clear' });
    enqueueOperation(USER, { kind: 'trip.history.clear' });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse({ applied: 1, ignored: 0 }));

    await flushOutbox(USER);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(String(init.body)) as { operations: { kind: string }[] };
    expect(sent.operations).toHaveLength(1);
    // La file de l'autre compte reste en attente de sa propre session.
    expect(pendingOperationCount(OTHER_USER)).toBe(1);
  });

  it('purge la file d un compte supprime', () => {
    enqueueOperation(USER, { kind: 'trip.history.clear' });
    enqueueOperation(OTHER_USER, { kind: 'trip.history.clear' });

    discardOperations(USER);

    expect(pendingOperationCount(USER)).toBe(0);
    expect(pendingOperationCount(OTHER_USER)).toBe(1);
  });
});

describe('sonde de disponibilite', () => {
  it("refuse de considerer l'API disponible si la reponse n'est pas celle attendue", async () => {
    // Cas reel d'un deploiement statique : /api/health renvoie l'index HTML
    // avec un code 200. Un simple response.ok ferait croire a une API presente.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<!doctype html><title>UrbanFlow</title>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    expect(await probeApi()).toBe(false);
  });
});
