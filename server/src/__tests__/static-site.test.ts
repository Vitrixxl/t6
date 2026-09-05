import { afterEach, beforeEach, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app';
import { staticSite } from '../plugins/static-site';
import { json, type OpenApiSpec } from './helpers';

let directory: string;
let api: ReturnType<typeof createApp>;
beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'urbanflow-static-'));
    await Bun.write(join(directory, 'index.html'), '<html><body>Client de recette</body></html>');
    api = createApp({ databasePath: ':memory:' });
});
afterEach(async () => {
    api.decorator.db.$client.close();
    await rm(directory, { recursive: true, force: true });
});

it('ne remplace jamais une API absente par la page du client, même en production', async () => {
    const app = new Elysia().use(api).use(staticSite(directory));
    for (const path of ['/api', '/api/state', '/api/transit/network', '/api/transit/journeys', '/api/inconnue']) {
        const response = await app.handle(new Request(`http://localhost${path}`));
        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({ error: 'Ressource inconnue.' });
    }
    const client = await app.handle(new Request('http://localhost/parcours'));
    expect(client.status).toBe(200);
    expect(await client.text()).toContain('Client de recette');
    expect((await app.handle(new Request('http://localhost/api/health'))).status).toBe(200);
});

it('ne présente pas la route attrape-tout du site comme un endpoint OpenAPI', async () => {
    const app = new Elysia().use(api).use(staticSite(directory));
    const response = await app.handle(new Request('http://localhost/api/doc/json'));
    const spec = await json<OpenApiSpec>(response);
    expect(Object.keys(spec.paths)).not.toContain('/*');
    expect(Object.keys(spec.paths)).toContain('/api/health');
});
