// Compte : droits RGPD.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { count } from 'drizzle-orm';
import { sessions, tripRecords } from '../db/schema.ts';
import { PASSWORD, TRIP_RECORD, createTestApi, json, type ExportBody, type TestApi } from './helpers.ts';

let api: TestApi;

beforeEach(() => {
  api = createTestApi();
});

afterEach(() => {
  api.close();
});

describe('RGPD', () => {
  it('exporte l integralite des donnees du compte (art. 20)', async () => {
    const cookie = await api.register('export@lyon.fr');
    await api.putCollection(cookie, '/api/trips/history', [TRIP_RECORD]);

    const response = await api.call('/api/me/export', { cookie });
    const body = await json<ExportBody>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('urbanflow-export.json');
    expect(body.account.email).toBe('export@lyon.fr');
    expect(body.tripRecords).toHaveLength(1);
  });

  it('efface le compte et toutes ses donnees liees (art. 17)', async () => {
    const cookie = await api.register('efface@lyon.fr');
    await api.putCollection(cookie, '/api/trips/history', [TRIP_RECORD]);

    expect((await api.call('/api/me', { method: 'DELETE', cookie })).status).toBe(200);

    expect((await api.call('/api/state', { cookie })).status).toBe(401);
    expect(
      (await api.call('/api/auth/login', { body: { email: 'efface@lyon.fr', password: PASSWORD } })).status,
    ).toBe(401);
    // Cascade : plus aucune ligne liee ne subsiste en base.
    expect(api.db.select({ c: count() }).from(tripRecords).get()?.c).toBe(0);
    expect(api.db.select({ c: count() }).from(sessions).get()?.c).toBe(0);
  });
});
