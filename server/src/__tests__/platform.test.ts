// Exploitation : sonde, documentation, en-têtes de sécurité, erreurs.
import { afterEach, beforeEach, expect, it } from 'bun:test';
import { createTestApi, json, type ErrorBody, type OpenApiSpec, type TestApi } from './helpers.ts';

let api: TestApi;

beforeEach(() => {
    api = createTestApi();
});

afterEach(() => {
    api.close();
});

it('expose une sonde de disponibilité', async () => {
    const response = await api.call('/api/health');

    expect(response.status).toBe(200);
    expect((await json<{ status: string }>(response)).status).toBe('ok');
});

it('publie une documentation OpenAPI decrivant les routes', async () => {
    const spec = await json<OpenApiSpec>(await api.call('/api/doc/json'));

    expect(spec.openapi).toStartWith('3.');
    expect(Object.keys(spec.paths)).toContain('/api/auth/login');
    expect(Object.keys(spec.paths)).toContain('/api/state');
    expect(Object.keys(spec.paths)).toContain('/api/trips/planned');
    expect(Object.keys(spec.paths)).toContain('/api/trips/planned/{id}');
    expect(Object.keys(spec.paths)).not.toContain('/api/trips/planned/{id}/completion');
    expect(Object.keys(spec.paths)).toContain('/api/me/profile');
});

it('pose les en-têtes de sécurité sur toutes les réponses', async () => {
    const response = await api.call('/api/health');

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
});

it('renvoie une erreur opaque sur une route inconnue', async () => {
    const response = await api.call('/api/inexistant');

    expect(response.status).toBe(404);
    expect((await json<ErrorBody>(response)).error).toBe('Ressource inconnue.');
});

it('ne publie plus de remplacement global de l’historique', async () => {
    const cookie = await api.register('parse@lyon.fr');
    const response = await api.call('/api/trips/history', { cookie, body: undefined, method: 'PUT' });

    expect(response.status).toBe(404);
});
