// Synchronisation : idempotence, atomicite, cloisonnement des comptes.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  TRIP_RECORD,
  TRIP_SHAPE,
  createTestApi,
  json,
  operation,
  type StateBody,
  type SyncBody,
  type TestApi,
} from './helpers.ts';

let api: TestApi;

beforeEach(() => {
  api = createTestApi();
});

afterEach(() => {
  api.close();
});

describe('file d operations', () => {
  it('applique un lot puis ignore son rejeu (idempotence)', async () => {
    const cookie = await api.register('sync@lyon.fr');
    const batch = { operations: [operation('trip.record', { record: TRIP_RECORD })] };

    const premier = await json<SyncBody>(await api.call('/api/state/operations', { cookie, body: batch }));
    const rejeu = await json<SyncBody>(await api.call('/api/state/operations', { cookie, body: batch }));

    expect(premier).toMatchObject({ applied: 1, ignored: 0 });
    // Le rejeu apres une reponse perdue ne cree pas de doublon.
    expect(rejeu).toMatchObject({ applied: 0, ignored: 1 });
    expect(rejeu.state.tripRecords).toHaveLength(1);
  });

  it('rejette le lot entier si une operation est invalide (atomicite)', async () => {
    const cookie = await api.register('atomique@lyon.fr');

    const response = await api.call('/api/state/operations', {
      cookie,
      body: {
        operations: [
          operation('trip.record', { record: TRIP_RECORD }),
          operation('trip.record', { record: { ...TRIP_RECORD, id: 'trip-2', distanceKm: -12 } }),
        ],
      },
    });

    expect(response.status).toBe(422);
    // Rien n'a ete ecrit : le client peut rejouer le lot corrige tel quel.
    expect((await json<StateBody>(await api.call('/api/state', { cookie }))).tripRecords).toHaveLength(0);
  });

  it('refuse un lot au-dela de la taille maximale', async () => {
    const cookie = await api.register('lot@lyon.fr');
    const operations = Array.from({ length: 201 }, () => operation('trip.history.clear'));

    expect((await api.call('/api/state/operations', { cookie, body: { operations } })).status).toBe(422);
  });

  it('ne laisse jamais un utilisateur voir les donnees d un autre', async () => {
    const alice = await api.register('alice@lyon.fr');
    const bob = await api.register('bob@lyon.fr');

    await api.call('/api/state/operations', {
      cookie: alice,
      body: { operations: [operation('trip.record', { record: TRIP_RECORD })] },
    });

    expect((await json<StateBody>(await api.call('/api/state', { cookie: bob }))).tripRecords).toHaveLength(0);
    expect((await json<StateBody>(await api.call('/api/state', { cookie: alice }))).tripRecords).toHaveLength(1);
  });
});

describe('routines', () => {
  it('supprime les occurrences d un trajet recurrent avec la routine', async () => {
    const cookie = await api.register('routine@lyon.fr');
    const recurringId = crypto.randomUUID();

    await api.call('/api/state/operations', {
      cookie,
      body: {
        operations: [
          operation('recurring.upsert', {
            trip: {
              ...TRIP_SHAPE,
              id: recurringId,
              label: 'Domicile - travail',
              daysOfWeek: [1, 2, 3, 4, 5],
              departureTime: '08:15',
              returnTime: '18:00',
              paused: false,
            },
          }),
          operation('planned.upsert', {
            trip: {
              ...TRIP_SHAPE,
              id: crypto.randomUUID(),
              label: 'Domicile - travail',
              scheduledFor: '2026-09-02T06:15:00.000Z',
              status: 'planned',
              recurringTripId: recurringId,
              completedAt: null,
            },
          }),
        ],
      },
    });

    expect((await json<StateBody>(await api.call('/api/state', { cookie }))).plannedTrips).toHaveLength(1);

    const apres = await json<SyncBody>(
      await api.call('/api/state/operations', {
        cookie,
        body: { operations: [operation('recurring.delete', { tripId: recurringId })] },
      }),
    );

    expect(apres.state.recurringTrips).toHaveLength(0);
    // Pas d'occurrence orpheline laissee derriere la routine.
    expect(apres.state.plannedTrips).toHaveLength(0);
  });

  it('met a jour une occurrence rejouee sous le meme identifiant', async () => {
    const cookie = await api.register('occurrence@lyon.fr');
    const tripId = crypto.randomUUID();
    const trip = {
      ...TRIP_SHAPE,
      id: tripId,
      label: 'Course du samedi',
      scheduledFor: '2026-09-05T09:00:00.000Z',
      status: 'planned' as const,
      recurringTripId: null,
      completedAt: null,
    };

    await api.call('/api/state/operations', { cookie, body: { operations: [operation('planned.upsert', { trip })] } });
    const apres = await json<SyncBody>(
      await api.call('/api/state/operations', {
        cookie,
        body: {
          operations: [
            operation('planned.upsert', {
              trip: { ...trip, status: 'done', completedAt: '2026-09-05T09:40:00.000Z' },
            }),
          ],
        },
      }),
    );

    expect(apres.state.plannedTrips).toHaveLength(1);
    expect(apres.state.plannedTrips[0].status).toBe('done');
  });
});
