// Compte : profil de mobilite et droits RGPD.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  PASSWORD,
  TRIP_RECORD,
  createTestApi,
  json,
  operation,
  type AuthBody,
  type ExportBody,
  type StateBody,
  type TestApi,
} from './helpers.ts';

let api: TestApi;

beforeEach(() => {
  api = createTestApi();
});

afterEach(() => {
  api.close();
});

describe('profil de mobilite', () => {
  it('enregistre le profil et le renvoie dans l etat', async () => {
    const cookie = await api.register('profil@lyon.fr');
    const profile = {
      displayName: 'Camille',
      preferredModes: ['bike', 'transit'],
      maxWalkMinutes: 10,
      accessibilityNeed: true,
      avoidRain: false,
      carbonGoalGramsPerWeek: 1800,
      weeklyTripsGoal: 8,
      weeklySavedGoalGrams: 3000,
    };

    const response = await api.call('/api/me/profile', { method: 'PUT', cookie, body: profile });

    expect(response.status).toBe(200);
    expect((await json<AuthBody>(response)).user.profile).toMatchObject(profile);
    expect((await json<StateBody>(await api.call('/api/state', { cookie }))).profile.maxWalkMinutes).toBe(10);
  });

  it('refuse une valeur hors bornes', async () => {
    const cookie = await api.register('bornes@lyon.fr');

    const response = await api.call('/api/me/profile', {
      method: 'PUT',
      cookie,
      body: {
        displayName: 'Camille',
        preferredModes: ['bike'],
        maxWalkMinutes: 240,
        accessibilityNeed: false,
        avoidRain: true,
        carbonGoalGramsPerWeek: 2500,
      },
    });

    expect(response.status).toBe(422);
  });
});

describe('RGPD', () => {
  it('exporte l integralite des donnees du compte (art. 20)', async () => {
    const cookie = await api.register('export@lyon.fr');
    await api.call('/api/state/operations', {
      cookie,
      body: { operations: [operation('trip.record', { record: TRIP_RECORD })] },
    });

    const response = await api.call('/api/me/export', { cookie });
    const body = await json<ExportBody>(response);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('urbanflow-export.json');
    expect(body.account.email).toBe('export@lyon.fr');
    expect(body.tripRecords).toHaveLength(1);
  });

  it('efface le compte et toutes ses donnees liees (art. 17)', async () => {
    const cookie = await api.register('efface@lyon.fr');
    await api.call('/api/state/operations', {
      cookie,
      body: { operations: [operation('trip.record', { record: TRIP_RECORD })] },
    });

    expect((await api.call('/api/me', { method: 'DELETE', cookie })).status).toBe(200);

    expect((await api.call('/api/state', { cookie })).status).toBe(401);
    expect(
      (await api.call('/api/auth/login', { body: { email: 'efface@lyon.fr', password: PASSWORD } })).status,
    ).toBe(401);
    // Cascade : plus aucune ligne liee ne subsiste en base.
    expect((api.db.query('SELECT count(*) AS c FROM trip_records').get() as { c: number }).c).toBe(0);
    expect((api.db.query('SELECT count(*) AS c FROM sessions').get() as { c: number }).c).toBe(0);
  });
});
