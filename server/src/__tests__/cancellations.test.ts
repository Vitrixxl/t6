// Les annulations sont rejouables, isolées par compte et persistées par l’API.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { recurringTrip, plannedTrip, accountState } from '../../../src/contracts/index.ts';
import { cancelRecurringDate } from '../services/recurring-trips.ts';
import { createRepositories } from '../repositories/index.ts';
import { createTestApi, PLANNED_TRIP, TRIP_SHAPE, type TestApi } from './helpers.ts';

let api: TestApi;
beforeEach(() => { api = createTestApi(); });
afterEach(() => { api.close(); });

const ROUTINE = {
    ...TRIP_SHAPE,
    label: 'Travail', daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    departureTime: '08:00', returnTime: '18:00', timeZone: 'Europe/Paris',
    createdAt: '2026-08-31T00:00:00.000Z',
    periods: [{ from: '2026-08-31T00:00:00.000Z', to: null }],
};
const path = '/api/trips/recurring/work';
const cancellation = `${path}/cancellations/2026-09-01`;

async function createRoutine(cookie: string) {
    const response = await api.putResource(cookie, path, ROUTINE);
    expect(response.status).toBe(200);
    return recurringTrip.parse(await response.json());
}

describe('annulations de passages récurrents', () => {
    it('conserve séparément l’aller et le retour, sans doublon au rejeu', async () => {
        const cookie = await api.register();
        await createRoutine(cookie);
        for (const directions of [['outbound'], ['outbound'], ['return']]) {
            expect((await api.putResource(cookie, cancellation, { directions })).status).toBe(200);
        }
        const state = accountState.parse(await (await api.call('/api/state', { cookie })).json());
        expect(state.recurringTrips[0]?.cancelledPassages).toEqual([
            { date: '2026-09-01', direction: 'outbound' }, { date: '2026-09-01', direction: 'return' },
        ]);
        expect(state.plannedTrips).toHaveLength(0);
        expect(state.tripRecords).toHaveLength(0);
        // Une ancienne vue de la routine ne doit pas effacer les exceptions.
        await api.putResource(cookie, path, { ...ROUTINE, label: 'Travail renommé' });
        const saved = createRepositories(api.db).recurringTrips.findById(state.recurringTrips[0]?.userId ?? '', 'work');
        expect(saved?.cancelledPassages).toHaveLength(2);
    });

    it('annule les deux sens atomiquement et conserve les autres dates', async () => {
        const cookie = await api.register();
        await createRoutine(cookie);
        await api.putResource(cookie, `${path}/cancellations/2026-08-31`, { directions: ['return'] });
        const response = await api.putResource(cookie, cancellation, { directions: ['outbound', 'return'] });
        expect(response.status).toBe(200);
        expect(recurringTrip.parse(await response.json()).cancelledPassages).toHaveLength(3);
    });

    it('refuse un autre compte, une date invalide, un passage futur et un retour inexistant', async () => {
        const cookie = await api.register();
        await createRoutine(cookie);
        const other = await api.register('autre@lyon.fr');
        expect((await api.putResource(other, cancellation, { directions: ['outbound'] })).status).toBe(404);
        expect((await api.putResource(cookie, `${path}/cancellations/2026-02-30`, { directions: ['outbound'] })).status).toBe(422);
        expect((await api.putResource(cookie, `${path}/cancellations/2099-09-01`, { directions: ['outbound'] })).status).toBe(404);
        await api.putResource(cookie, path, { ...ROUTINE, returnTime: null });
        expect((await api.putResource(cookie, cancellation, { directions: ['outbound', 'return'] })).status).toBe(404);
        expect((await api.call(cancellation, { method: 'PUT', body: { directions: ['outbound'] } })).status).toBe(401);
    });

    it('utilise le fuseau de la routine et refuse une annulation partielle des deux sens', async () => {
        const cookie = await api.register();
        const routine = await createRoutine(cookie);
        // À 07:00 UTC il est 09:00 à Paris : l’aller est passé, le retour ne l’est pas.
        const now = new Date('2026-09-01T07:00:00Z');
        expect(cancelRecurringDate(api.db, routine.userId, routine.id, '2026-09-01', ['outbound', 'return'], now)).toBeNull();
        expect(createRepositories(api.db).recurringTrips.findById(routine.userId, routine.id)?.cancelledPassages).toEqual([]);
        expect(cancelRecurringDate(api.db, routine.userId, routine.id, '2026-09-01', ['outbound'], now)?.cancelledPassages)
            .toEqual([{ date: '2026-09-01', direction: 'outbound' }]);
    });

    it('refuse les journées en pause et antérieures à la création', async () => {
        const cookie = await api.register();
        await api.putResource(cookie, path, { ...ROUTINE, periods: [{ from: '2026-08-31T00:00:00Z', to: '2026-09-01T00:00:00Z' }] });
        expect((await api.putResource(cookie, cancellation, { directions: ['outbound'] })).status).toBe(404);
        expect((await api.putResource(cookie, `${path}/cancellations/2026-08-30`, { directions: ['outbound'] })).status).toBe(404);
    });
});

describe('annulation d’un trajet ponctuel terminé', () => {
    it('conserve le trajet annulé et retire son historique carbone, même au rejeu', async () => {
        const cookie = await api.register();
        await api.putResource(cookie, '/api/trips/planned/once', PLANNED_TRIP);
        await api.call('/api/trips/planned/once/completion', { method: 'PUT', cookie });
        expect((await api.putResource(cookie, '/api/trips/planned/once', PLANNED_TRIP)).status).toBe(409);
        for (let repeat = 0; repeat < 2; repeat += 1) {
            const response = await api.call('/api/trips/planned/once/cancellation', { method: 'PUT', cookie });
            expect(response.status).toBe(200);
            expect(plannedTrip.parse(await response.json()).status).toBe('cancelled');
        }
        const state = accountState.parse(await (await api.call('/api/state', { cookie })).json());
        expect(state.plannedTrips).toHaveLength(1);
        expect(state.tripRecords).toHaveLength(0);
    });

    it('isole l’annulation du compte voisin et des autres trajets', async () => {
        const cookie = await api.register();
        const other = await api.register('voisin@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/once', PLANNED_TRIP);
        await api.putResource(cookie, '/api/trips/planned/keep', PLANNED_TRIP);
        await api.call('/api/trips/planned/keep/completion', { method: 'PUT', cookie });
        expect((await api.call('/api/trips/planned/once/cancellation', { method: 'PUT', cookie: other })).status).toBe(404);
        await api.call('/api/trips/planned/once/cancellation', { method: 'PUT', cookie });
        const state = accountState.parse(await (await api.call('/api/state', { cookie })).json());
        expect(state.tripRecords.map((record) => record.id)).toEqual(['trip:keep']);
    });
});

it('rétablit un seul sens, de façon idempotente et isolée par compte', async () => {
    const cookie = await api.register();
    await createRoutine(cookie);
    await api.putResource(cookie, cancellation, { directions: ['outbound', 'return'] });
    await api.putResource(cookie, `${path}/cancellations/2026-08-31`, { directions: ['outbound'] });
    const other = await api.register('autre@lyon.fr');
    expect((await api.call(`${cancellation}/outbound`, { method: 'DELETE', cookie: other })).status).toBe(404);
    expect((await api.call(`${cancellation}/outbound`, { method: 'DELETE' })).status).toBe(401);
    expect((await api.call(`${cancellation}/bad`, { method: 'DELETE', cookie })).status).toBe(422);
    for (let repeat = 0; repeat < 2; repeat += 1) {
        const response = await api.call(`${cancellation}/outbound`, { method: 'DELETE', cookie });
        expect(response.status).toBe(200);
        expect(recurringTrip.parse(await response.json()).cancelledPassages).toEqual([
            { date: '2026-09-01', direction: 'return' }, { date: '2026-08-31', direction: 'outbound' },
        ]);
    }
});
