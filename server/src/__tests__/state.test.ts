// Etat du compte : remplacement par collection, idempotence, atomicite,
// isolation entre collections, cloisonnement entre comptes.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { DEFAULT_PROFILE } from '../models/profile.ts';
import { TRIP_RECORD, TRIP_SHAPE, createTestApi, json, type AuthBody, type StateBody, type TestApi } from './helpers.ts';

let api: TestApi;

beforeEach(() => {
  api = createTestApi();
});

afterEach(() => {
  api.close();
});

const ROUTINE = {
  ...TRIP_SHAPE,
  id: 'routine-1',
  label: 'Domicile - travail',
  daysOfWeek: [1, 2, 3, 4, 5],
  departureTime: '08:15',
  returnTime: '18:00',
  periods: [{ from: '2026-08-31T06:00:00.000Z', to: null }],
};

const OCCURRENCE = {
  ...TRIP_SHAPE,
  id: 'trip-1',
  label: 'Domicile - travail',
  scheduledFor: '2026-09-02T06:15:00.000Z',
  status: 'planned',
  completedAt: null,
};

const readState = async (cookie: string) => json<StateBody>(await api.call('/api/state', { cookie }));

describe('remplacement d une collection', () => {
  it('remplace la collection et rend le meme resultat au rejeu (idempotence)', async () => {
    const cookie = await api.register('rejeu@lyon.fr');

    const premier = await json<{ id: string }[]>(await api.putCollection(cookie, '/api/trips/history', [TRIP_RECORD]));
    const rejeu = await json<{ id: string }[]>(await api.putCollection(cookie, '/api/trips/history', [TRIP_RECORD]));

    expect(premier).toHaveLength(1);
    // Le rejeu apres une reponse perdue ne cree pas de doublon.
    expect(rejeu).toHaveLength(1);
    expect((await readState(cookie)).tripRecords).toHaveLength(1);
  });

  it('retire ce que le client ne porte plus, sans toucher aux autres collections', async () => {
    const cookie = await api.register('retrait@lyon.fr');
    await api.putCollection(cookie, '/api/trips/recurring', [ROUTINE]);
    await api.putCollection(cookie, '/api/trips/planned', [OCCURRENCE]);

    // Le client a supprime la routine : il renvoie la liste des routines sans elle.
    const routines = await json<unknown[]>(await api.putCollection(cookie, '/api/trips/recurring', []));

    expect(routines).toHaveLength(0);
    const state = await readState(cookie);
    expect(state.recurringTrips).toHaveLength(0);
    expect(state.plannedTrips).toHaveLength(1);
  });

  it('met a jour une occurrence sous le meme identifiant', async () => {
    const cookie = await api.register('occurrence@lyon.fr');
    await api.putCollection(cookie, '/api/trips/planned', [OCCURRENCE]);

    const apres = await json<{ status: string }[]>(
      await api.putCollection(cookie, '/api/trips/planned', [
        { ...OCCURRENCE, status: 'done', completedAt: '2026-09-02T06:55:00.000Z' },
      ]),
    );

    expect(apres).toHaveLength(1);
    expect(apres[0].status).toBe('done');
  });

  it('rejette la collection entiere si une ligne est invalide (atomicite)', async () => {
    const cookie = await api.register('atomique@lyon.fr');

    const response = await api.putCollection(cookie, '/api/trips/history', [
      TRIP_RECORD,
      { ...TRIP_RECORD, id: 'trip-2', distanceKm: -12 },
    ]);

    expect(response.status).toBe(422);
    // Rien n'a ete ecrit : le client peut renvoyer la liste corrigee telle quelle.
    expect((await readState(cookie)).tripRecords).toHaveLength(0);
  });

  it('une collection invalide ne bloque pas les autres', async () => {
    const cookie = await api.register('isolement@lyon.fr');

    expect((await api.putCollection(cookie, '/api/trips/history', [{ ...TRIP_RECORD, distanceKm: -12 }])).status).toBe(422);
    expect((await api.putCollection(cookie, '/api/trips/planned', [OCCURRENCE])).status).toBe(200);

    expect((await readState(cookie)).plannedTrips).toHaveLength(1);
  });

  it('refuse une collection au-dela des bornes de conservation', async () => {
    const cookie = await api.register('borne@lyon.fr');
    const tripRecords = Array.from({ length: 51 }, (_, index) => ({ ...TRIP_RECORD, id: `trip-${index}` }));

    expect((await api.putCollection(cookie, '/api/trips/history', tripRecords)).status).toBe(422);
  });

  it('ne laisse jamais un utilisateur voir les donnees d un autre', async () => {
    const alice = await api.register('alice@lyon.fr');
    const bob = await api.register('bob@lyon.fr');

    await api.putCollection(alice, '/api/trips/history', [TRIP_RECORD]);

    expect((await readState(bob)).tripRecords).toHaveLength(0);
    expect((await readState(alice)).tripRecords).toHaveLength(1);
  });
});

describe('profil de mobilite', () => {
  it('remplace le profil et le reflete sur la session, sans toucher aux trajets', async () => {
    const cookie = await api.register('profil@lyon.fr');
    await api.putCollection(cookie, '/api/trips/history', [TRIP_RECORD]);
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

    const response = await api.putProfile(cookie, profile);

    expect(response.status).toBe(200);
    expect((await json<{ maxWalkMinutes: number }>(response)).maxWalkMinutes).toBe(10);
    // Le nom affiche suit le profil : la session le rend a jour.
    expect((await json<AuthBody>(await api.call('/api/auth/session', { cookie }))).user.displayName).toBe('Camille');
    // Le profil vit seul : l'historique n'a pas ete reecrit.
    expect((await readState(cookie)).tripRecords).toHaveLength(1);
  });

  it('refuse une valeur hors bornes', async () => {
    const cookie = await api.register('bornes@lyon.fr');

    const response = await api.putProfile(cookie, { ...DEFAULT_PROFILE, maxWalkMinutes: 240 });

    expect(response.status).toBe(422);
  });
});
