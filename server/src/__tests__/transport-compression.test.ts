import { afterEach, beforeEach, expect, it } from 'bun:test';
import { stopCollection } from '../../../src/contracts/transport.ts';
import { createApp } from '../app.ts';

let app: ReturnType<typeof createApp>;
beforeEach(() => { app = createApp({ databasePath: ':memory:' }); });
afterEach(() => { app.decorator.db.$client.close(); });
const path = '/api/transport/stops?x=96&y=915&version=test';
function read(pathname: string, encoding?: string) {
    return app.handle(new Request(`http://localhost${pathname}`, { headers: encoding ? { 'accept-encoding': encoding } : {} }));
}

it('compresse les quais sans modifier le JSON, les contrats ni les en-têtes de sécurité', async () => {
    const plain = await read(path);
    const text = await plain.text();
    const zipped = await read(path, 'br, gzip;q=0.8');
    expect(zipped.headers.get('content-encoding')).toBe('gzip');
    expect(zipped.headers.get('vary')).toBe('Accept-Encoding');
    expect(zipped.headers.get('content-type')).toContain('application/json');
    expect(zipped.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(zipped.headers.get('cache-control')).toContain('max-age=3600');
    const bytes = new Uint8Array(await zipped.arrayBuffer());
    expect(bytes.length).toBeLessThan(text.length / 2);
    expect(new TextDecoder().decode(Bun.gunzipSync(bytes))).toBe(text);
});

it('respecte le refus de gzip, son absence et la préférence explicite sur le joker', async () => {
    for (const encoding of [undefined, 'br', 'gzip;q=0', 'gzip;q=0.000, *;q=1']) {
        const response = await read(path, encoding);
        expect(response.headers.get('content-encoding')).toBeNull();
        expect(response.headers.get('vary')).toBe('Accept-Encoding');
        expect(stopCollection.parse(await response.json()).stops.length).toBeGreaterThan(0);
    }
    expect((await read(path, '*;q=1')).headers.get('content-encoding')).toBe('gzip');
});

it('laisse les petits résultats, les erreurs et les ressources du compte sans compression', async () => {
    const empty = await read('/api/transport/stops?x=1&y=1&version=test', 'gzip');
    expect(empty.headers.get('content-encoding')).toBeNull();
    expect(await empty.json()).toEqual({ stops: [] });
    const invalid = await read('/api/transport/stops?x=invalide&y=1&version=test', 'gzip');
    expect(invalid.status).toBe(422);
    expect(invalid.headers.get('content-encoding')).toBeNull();
    const missing = await read('/api/absent', 'gzip');
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Ressource inconnue.' });
    const session = await read('/api/auth/session', 'gzip');
    expect(session.headers.get('content-encoding')).toBeNull();
});
