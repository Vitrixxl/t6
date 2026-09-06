// Compte : droits RGPD.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { count } from 'drizzle-orm';
import { TERMS_VERSION } from '../../../src/contracts/index.ts';
import { sessions, tripRecords } from '../db/schema.ts';
import { PASSWORD, PLANNED_TRIP, createTestApi, json, type ExportBody, type TestApi } from './helpers.ts';

let api: TestApi;

beforeEach(() => {
    api = createTestApi();
});

afterEach(() => {
    api.close();
});

describe('RGPD', () => {
    it('exporte l’integralite des données du compte (art. 20)', async () => {
        const cookie = await api.register('export@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);
        await api.call('/api/trips/planned', { cookie });

        const response = await api.call('/api/me/export', { cookie });
        const body = await json<ExportBody>(response);

        expect(response.status).toBe(200);
        expect(response.headers.get('content-disposition')).toContain('urbanflow-export.json');
        expect(body.account.email).toBe('export@lyon.fr');
        expect(body.account.termsVersion).toBe(TERMS_VERSION);
        expect(body.account.termsAcceptedAt).toBeString();
        expect(body.tripRecords).toHaveLength(1);
    });

    it('efface le compte et toutes ses données liées (art. 17)', async () => {
        const cookie = await api.register('efface@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);
        await api.call('/api/trips/planned', { cookie });

        expect((await api.call('/api/me', { method: 'DELETE', cookie })).status).toBe(200);

        expect((await api.call('/api/trips/planned', { cookie })).status).toBe(401);
        expect(
            (await api.call('/api/auth/login', { body: { email: 'efface@lyon.fr', password: PASSWORD } })).status,
        ).toBe(401);
        // Cascade : plus aucune ligne liée ne subsiste en base.
        expect(api.db.select({ c: count() }).from(tripRecords).get()?.c).toBe(0);
        expect(api.db.select({ c: count() }).from(sessions).get()?.c).toBe(0);
    });
});
