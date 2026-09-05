import { afterEach, beforeEach, expect, it } from 'bun:test';
import { createTestApi, PLANNED_TRIP, type TestApi } from './helpers.ts';
import { accountState, plannedTrip } from '../../../src/contracts/index.ts';
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
    const read = async () => accountState.parse(await (await api.call('/api/state', { cookie })).json());
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
    const state = accountState.parse(await (await api.call('/api/state', { cookie })).json());
    expect(state.tripRecords).toHaveLength(1);
    expect(state.tripRecords[0]?.createdAt).toBe(PLANNED_TRIP.scheduledFor);
});

it('rétablit un ponctuel futur sans le compter dans le carbone', async () => {
    const cookie = await api.register();
    await api.putResource(cookie, '/api/trips/planned/restore', { ...PLANNED_TRIP, scheduledFor: '2099-01-01T08:00:00Z', status: 'cancelled' });
    const response = await api.call('/api/trips/planned/restore/cancellation', { method: 'DELETE', cookie });
    expect(plannedTrip.parse(await response.json()).status).toBe('planned');
    const state = accountState.parse(await (await api.call('/api/state', { cookie })).json());
    expect(state.tripRecords).toHaveLength(0);
});
