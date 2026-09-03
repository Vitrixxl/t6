// Synchronisation : remplacement d'etat, idempotence, atomicite, cloisonnement.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  TRIP_RECORD,
  TRIP_SHAPE,
  createTestApi,
  json,
  stateWith,
  type AuthBody,
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

describe('remplacement d etat', () => {
  it('remplace l etat et rend le meme resultat au rejeu (idempotence)', async () => {
    const cookie = await api.register('sync@lyon.fr');
    const state = stateWith({ tripRecords: [TRIP_RECORD] });

    const premier = await json<StateBody>(await api.putState(cookie, state));
    const rejeu = await json<StateBody>(await api.putState(cookie, state));

    expect(premier.tripRecords).toHaveLength(1);
    // Le rejeu apres une reponse perdue ne cree pas de doublon.
    expect(rejeu.tripRecords).toHaveLength(1);
  });

  it('retire ce que le client ne porte plus', async () => {
    const cookie = await api.register('retrait@lyon.fr');
    await api.putState(cookie, stateWith({ recurringTrips: [ROUTINE], plannedTrips: [OCCURRENCE] }));

    expect((await json<StateBody>(await api.call('/api/state', { cookie }))).plannedTrips).toHaveLength(1);

    // Le client a supprime la routine et ses occurrences : il envoie l'etat sans elles.
    const apres = await json<StateBody>(await api.putState(cookie, stateWith()));

    expect(apres.recurringTrips).toHaveLength(0);
    expect(apres.plannedTrips).toHaveLength(0);
  });

  it('met a jour une occurrence sous le meme identifiant', async () => {
    const cookie = await api.register('occurrence@lyon.fr');
    await api.putState(cookie, stateWith({ plannedTrips: [OCCURRENCE] }));

    const apres = await json<StateBody>(
      await api.putState(
        cookie,
        stateWith({ plannedTrips: [{ ...OCCURRENCE, status: 'done', completedAt: '2026-09-02T06:55:00.000Z' }] }),
      ),
    );

    expect(apres.plannedTrips).toHaveLength(1);
    expect(apres.plannedTrips[0].status).toBe('done');
  });

  it('rejette l etat entier si une ligne est invalide (atomicite)', async () => {
    const cookie = await api.register('atomique@lyon.fr');

    const response = await api.putState(
      cookie,
      stateWith({ tripRecords: [TRIP_RECORD, { ...TRIP_RECORD, id: 'trip-2', distanceKm: -12 }] }),
    );

    expect(response.status).toBe(422);
    // Rien n'a ete ecrit : le client peut renvoyer l'etat corrige tel quel.
    expect((await json<StateBody>(await api.call('/api/state', { cookie }))).tripRecords).toHaveLength(0);
  });

  it('refuse un etat au-dela des bornes de conservation', async () => {
    const cookie = await api.register('borne@lyon.fr');
    const tripRecords = Array.from({ length: 51 }, (_, index) => ({ ...TRIP_RECORD, id: `trip-${index}` }));

    expect((await api.putState(cookie, stateWith({ tripRecords }))).status).toBe(422);
  });

  it('ne laisse jamais un utilisateur voir les donnees d un autre', async () => {
    const alice = await api.register('alice@lyon.fr');
    const bob = await api.register('bob@lyon.fr');

    await api.putState(alice, stateWith({ tripRecords: [TRIP_RECORD] }));

    expect((await json<StateBody>(await api.call('/api/state', { cookie: bob }))).tripRecords).toHaveLength(0);
    expect((await json<StateBody>(await api.call('/api/state', { cookie: alice }))).tripRecords).toHaveLength(1);
  });
});

describe('profil de mobilite', () => {
  it('enregistre le profil avec l etat et le reflete sur la session', async () => {
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

    const response = await api.putState(cookie, stateWith({ profile }));

    expect(response.status).toBe(200);
    expect((await json<StateBody>(response)).profile.maxWalkMinutes).toBe(10);
    // Le nom affiche suit le profil : la session le rend a jour.
    expect((await json<AuthBody>(await api.call('/api/auth/session', { cookie }))).user.displayName).toBe('Camille');
  });

  it('refuse une valeur hors bornes', async () => {
    const cookie = await api.register('bornes@lyon.fr');

    const response = await api.putState(
      cookie,
      stateWith({
        profile: {
          displayName: 'Camille',
          preferredModes: ['bike'],
          maxWalkMinutes: 240,
          accessibilityNeed: false,
          avoidRain: true,
          carbonGoalGramsPerWeek: 2500,
        },
      }),
    );

    expect(response.status).toBe(422);
  });
});
