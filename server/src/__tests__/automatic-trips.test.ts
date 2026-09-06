import { afterEach, beforeEach, expect, it } from 'bun:test';
import { createTestApi, PLANNED_TRIP, type TestApi } from './helpers.ts';
import { session, plannedTrip } from '../../../src/contracts/index.ts';
import { createRepositories } from '../repositories/index.ts';
import { completeDueTrips } from '../services/planned-trips.ts';

let api: TestApi;
beforeEach(() => { api = createTestApi(); });
afterEach(() => api.close());

it('compte seulement les ponctuels passés non annulés et date le carbone au départ prévu', async () => {
    const cookie = await api.register();
    await api.putResource(cookie, '/api/trips/planned/past', PLANNED_TRIP);
    await api.putResource(cookie, '/api/trips/planned/future', { ...PLANNED_TRIP, scheduledFor: '2099-01-01T08:00:00Z' });
    await api.putResource(cookie, '/api/trips/planned/cancelled', { ...PLANNED_TRIP, status: 'cancelled' });
    const read = async () => session.parse(await (await api.call('/api/auth/session', { cookie })).json()).state;
    for (let repeat = 0; repeat < 2; repeat += 1) {
        const state = await read();
        expect(state.tripRecords).toHaveLength(1);
        expect(state.tripRecords[0]?.createdAt).toBe(PLANNED_TRIP.scheduledFor);
        expect(state.plannedTrips.find((trip) => trip.id === 'future')?.status).toBe('planned');
        expect(state.plannedTrips.find((trip) => trip.id === 'cancelled')?.status).toBe('cancelled');
    }
    expect((await api.call('/api/trips/planned/future/completion', { method: 'PUT', cookie })).status).toBe(404);
    await api.call('/api/trips/history', { method: 'DELETE', cookie });
    expect((await read()).tripRecords).toHaveLength(0);
});

it('bascule après la date exacte et corrige les anciennes réalisations anticipées', async () => {
    const cookie = await api.register();
    const response = await api.putResource(cookie, '/api/trips/planned/boundary', { ...PLANNED_TRIP, scheduledFor: '2099-01-01T08:00:00Z' });
    const trip = plannedTrip.parse(await response.json());
    const repos = createRepositories(api.db);
    const deadline = new Date(trip.scheduledFor);
    completeDueTrips(api.db, trip.userId, deadline);
    expect(repos.plannedTrips.findById(trip.userId, trip.id)?.status).toBe('planned');
    completeDueTrips(api.db, trip.userId, new Date(deadline.getTime() + 1));
    expect(repos.tripRecords.list(trip.userId)).toHaveLength(1);
    expect(repos.plannedTrips.findById(trip.userId, trip.id)?.completedAt).toBe(trip.scheduledFor);
    completeDueTrips(api.db, trip.userId, new Date(deadline.getTime() - 1));
    expect(repos.plannedTrips.findById(trip.userId, trip.id)?.status).toBe('planned');
    expect(repos.tripRecords.list(trip.userId)).toHaveLength(0);
});

it('efface les ponctuels passés depuis six mois, sans toucher aux ponctuels à venir ni au bilan carbone', async () => {
    const cookie = await api.register();
    const other = await api.register('voisin@example.test');
    const scheduledFor = '2026-03-01T08:00:00.000Z';
    await api.putResource(cookie, '/api/trips/planned/old', { ...PLANNED_TRIP, scheduledFor });
    await api.putResource(cookie, '/api/trips/planned/old-cancelled', { ...PLANNED_TRIP, scheduledFor, status: 'cancelled' });
    await api.putResource(cookie, '/api/trips/planned/future', { ...PLANNED_TRIP, scheduledFor: '2099-01-01T08:00:00Z' });
    const neighborId = plannedTrip.parse(await (await api.putResource(other, '/api/trips/planned/old', { ...PLANNED_TRIP, scheduledFor })).json()).userId;
    const userId = plannedTrip.parse(await (await api.putResource(cookie, '/api/trips/planned/old', { ...PLANNED_TRIP, scheduledFor })).json()).userId;
    const repos = createRepositories(api.db);

    // Six mois moins une milliseconde : rien n'est effacé, le trajet est réalisé.
    completeDueTrips(api.db, userId, new Date('2026-09-01T07:59:59.999Z'));
    expect(repos.plannedTrips.list(userId).map((trip) => trip.id).sort()).toEqual(['future', 'old', 'old-cancelled']);
    expect(repos.plannedTrips.findById(userId, 'old')?.status).toBe('done');

    completeDueTrips(api.db, userId, new Date('2026-09-01T08:00:00.001Z'));
    expect(repos.plannedTrips.list(userId).map((trip) => trip.id)).toEqual(['future']);
    // L'entrée carbone, sans coordonnées, reste dans l'historique.
    expect(repos.tripRecords.list(userId).map((record) => record.id)).toEqual(['trip:old']);
    // La purge d'un compte ne touche pas les lignes d'un autre.
    expect(repos.plannedTrips.findById(neighborId, 'old')).not.toBeNull();
});

it('rétablit un ponctuel passé à sa date prévue, une seule fois, en préservant les autres comptes', async () => {
    const cookie = await api.register();
    const other = await api.register('voisin@example.test');
    await api.putResource(cookie, '/api/trips/planned/restore', { ...PLANNED_TRIP, status: 'cancelled' });
    expect((await api.call('/api/trips/planned/restore/cancellation', { method: 'DELETE', cookie: other })).status).toBe(404);
    expect((await api.call('/api/trips/planned/restore/cancellation', { method: 'DELETE' })).status).toBe(401);
    for (let repeat = 0; repeat < 2; repeat += 1) {
        const response = await api.call('/api/trips/planned/restore/cancellation', { method: 'DELETE', cookie });
        expect(response.status).toBe(200);
        expect(plannedTrip.parse(await response.json()).completedAt).toBe(PLANNED_TRIP.scheduledFor);
    }
    const state = session.parse(await (await api.call('/api/auth/session', { cookie })).json()).state;
    expect(state.tripRecords).toHaveLength(1);
    expect(state.tripRecords[0]?.createdAt).toBe(PLANNED_TRIP.scheduledFor);
});

it('rétablit un ponctuel futur sans le compter dans le carbone', async () => {
    const cookie = await api.register();
    await api.putResource(cookie, '/api/trips/planned/restore', { ...PLANNED_TRIP, scheduledFor: '2099-01-01T08:00:00Z', status: 'cancelled' });
    const response = await api.call('/api/trips/planned/restore/cancellation', { method: 'DELETE', cookie });
    expect(plannedTrip.parse(await response.json()).status).toBe('planned');
    const state = session.parse(await (await api.call('/api/auth/session', { cookie })).json()).state;
    expect(state.tripRecords).toHaveLength(0);
});
