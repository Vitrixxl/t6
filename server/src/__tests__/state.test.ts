// Etat du compte : commandes granulaires, idempotence, transition atomique,
// cloisonnement entre ressources et entre comptes.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { DEFAULT_PROFILE } from '../../../src/contracts/index.ts';
import { PLANNED_TRIP, TRIP_SHAPE, createTestApi, json, type AuthBody, type StateBody, type TestApi } from './helpers.ts';

let api: TestApi;

beforeEach(() => {
    api = createTestApi();
});

afterEach(() => {
    api.close();
});

const ROUTINE = {
    ...TRIP_SHAPE,
    label: 'Domicile - travail',
    daysOfWeek: [1, 2, 3, 4, 5],
    departureTime: '08:15',
    returnTime: '18:00',
    periods: [{ from: '2026-08-31T06:00:00.000Z', to: null }],
};

const SAVED_ROUTE = {
    ...TRIP_SHAPE,
    routeId: 'bike',
    routeTitle: 'Velo',
    score: 82,
};

const readState = async (cookie: string) => json<StateBody>(await api.call('/api/state', { cookie }));

describe('ressources du compte', () => {
    it('rejoue le PUT d une ressource sans doublon', async () => {
        const cookie = await api.register('rejeu@lyon.fr');

        const first = await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);
        const replay = await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);

        expect(first.status).toBe(200);
        expect(replay.status).toBe(200);
        expect((await readState(cookie)).plannedTrips).toHaveLength(1);
    });

    it('ecrit une ressource sans ecraser les autres lignes de la collection', async () => {
        const cookie = await api.register('granulaire@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);

        await api.putResource(cookie, '/api/trips/planned/trip-2', {
            ...PLANNED_TRIP,
            label: 'Deuxieme trajet',
            scheduledFor: '2026-09-03T06:15:00.000Z',
        });

        expect((await readState(cookie)).plannedTrips.map((trip) => trip.id)).toEqual(['trip-1', 'trip-2']);
    });

    it('supprime une ressource sans toucher a sa voisine ni a une autre collection', async () => {
        const cookie = await api.register('retrait@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);
        await api.putResource(cookie, '/api/trips/planned/trip-2', { ...PLANNED_TRIP, label: 'A conserver' });
        await api.putResource(cookie, '/api/trips/recurring/routine-1', ROUTINE);

        expect((await api.call('/api/trips/planned/trip-1', { method: 'DELETE', cookie })).status).toBe(200);

        const state = await readState(cookie);
        expect(state.plannedTrips.map((trip) => trip.id)).toEqual(['trip-2']);
        expect(state.recurringTrips).toHaveLength(1);
    });

    it('met a jour une routine sans reecrire sa voisine', async () => {
        const cookie = await api.register('routines-granulaires@lyon.fr');
        await api.putResource(cookie, '/api/trips/recurring/routine-1', ROUTINE);
        await api.putResource(cookie, '/api/trips/recurring/routine-2', { ...ROUTINE, label: 'Salle de sport' });

        await api.putResource(cookie, '/api/trips/recurring/routine-1', {
            ...ROUTINE,
            periods: [{ from: '2026-08-31T06:00:00.000Z', to: '2026-09-04T12:00:00.000Z' }],
        });

        expect((await readState(cookie)).recurringTrips.map((routine) => routine.id).sort()).toEqual(['routine-1', 'routine-2']);
    });

    it('supprime un itineraire enregistre sans reecrire sa voisine', async () => {
        const cookie = await api.register('favoris-granulaires@lyon.fr');
        await api.putResource(cookie, '/api/saved-routes/saved-1', SAVED_ROUTE);
        await api.putResource(cookie, '/api/saved-routes/saved-2', { ...SAVED_ROUTE, routeId: 'walk', routeTitle: 'Marche' });

        await api.call('/api/saved-routes/saved-1', { method: 'DELETE', cookie });

        expect((await readState(cookie)).savedRoutes.map((route) => route.id)).toEqual(['saved-2']);
    });

    it('persiste une comparaison voiture indisponible comme null', async () => {
        const cookie = await api.register('comparaison-indisponible@lyon.fr');
        const response = await api.putResource(cookie, '/api/trips/planned/trip-1', {
            ...PLANNED_TRIP,
            carbonSavedGrams: null,
        });

        expect(response.status).toBe(200);
        expect((await json<{ carbonSavedGrams: number | null }>(response)).carbonSavedGrams).toBeNull();
    });

    it('rejette une ressource invalide sans alterer celle deja stockee', async () => {
        const cookie = await api.register('validation@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);

        const response = await api.putResource(cookie, '/api/trips/planned/trip-2', {
            ...PLANNED_TRIP,
            distanceKm: -12,
        });

        expect(response.status).toBe(422);
        expect((await readState(cookie)).plannedTrips.map((trip) => trip.id)).toEqual(['trip-1']);
    });

    it('termine le trajet et cree l historique dans une seule transition idempotente', async () => {
        const cookie = await api.register('completion@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);

        const first = await api.call('/api/trips/planned/trip-1/completion', { method: 'PUT', cookie });
        const replay = await api.call('/api/trips/planned/trip-1/completion', { method: 'PUT', cookie });

        expect(first.status).toBe(200);
        expect(replay.status).toBe(200);
        const state = await readState(cookie);
        expect(state.plannedTrips[0].status).toBe('done');
        expect(state.tripRecords).toHaveLength(1);
        expect(state.tripRecords[0].id).toBe('trip:trip-1');
    });

    it('n invente aucun historique si le trajet a terminer n existe pas', async () => {
        const cookie = await api.register('completion-absente@lyon.fr');

        expect((await api.call('/api/trips/planned/inconnu/completion', { method: 'PUT', cookie })).status).toBe(404);
        expect((await readState(cookie)).tripRecords).toHaveLength(0);
    });

    it('n autorise pas le client a fabriquer directement un trajet termine', async () => {
        const cookie = await api.register('transition@lyon.fr');

        const response = await api.putResource(cookie, '/api/trips/planned/trip-1', {
            ...PLANNED_TRIP,
            status: 'done',
            completedAt: '2026-09-02T07:00:00.000Z',
        });

        expect(response.status).toBe(422);
        expect((await readState(cookie)).plannedTrips).toHaveLength(0);
    });

    it('efface l historique uniquement par la commande explicite DELETE', async () => {
        const cookie = await api.register('historique@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);
        await api.call('/api/trips/planned/trip-1/completion', { method: 'PUT', cookie });

        expect((await api.call('/api/trips/history', { method: 'PUT', cookie, body: [] })).status).toBe(404);
        expect((await api.call('/api/trips/history', { method: 'DELETE', cookie })).status).toBe(200);
        expect((await readState(cookie)).tripRecords).toHaveLength(0);
        expect((await readState(cookie)).plannedTrips).toHaveLength(1);
    });

    it('lit chaque collection seule et exige une session', async () => {
        const cookie = await api.register('lecture@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);

        const planned = await json<{ id: string; userId: string }[]>(await api.call('/api/trips/planned', { cookie }));
        const history = await json<unknown[]>(await api.call('/api/trips/history', { cookie }));

        expect(planned).toHaveLength(1);
        expect(planned[0].userId).toBeDefined();
        expect(history).toHaveLength(0);
        expect((await api.call('/api/trips/planned')).status).toBe(401);
    });

    it('ne laisse jamais un utilisateur modifier les donnees d un autre', async () => {
        const alice = await api.register('alice@lyon.fr');
        const bob = await api.register('bob@lyon.fr');
        await api.putResource(alice, '/api/trips/planned/trip-1', PLANNED_TRIP);

        await api.call('/api/trips/planned/trip-1', { method: 'DELETE', cookie: bob });

        expect((await readState(bob)).plannedTrips).toHaveLength(0);
        expect((await readState(alice)).plannedTrips).toHaveLength(1);
    });
});

describe('profil de mobilite', () => {
    it('remplace le profil sans toucher aux trajets', async () => {
        const cookie = await api.register('profil@lyon.fr');
        await api.putResource(cookie, '/api/trips/planned/trip-1', PLANNED_TRIP);
        const profile = {
            displayName: 'Camille',
            preferredModes: ['bike', 'transit'],
            maxWalkMinutes: 10,
            accessibilityNeed: true,
            avoidRain: false,
            carbonGoalGramsPerWeek: 1800,
            weeklyTripsGoal: 8,
            weeklySavedGoalGrams: 3000,
            monthlySavedGoalGrams: 14000,
        };

        const response = await api.putProfile(cookie, profile);

        expect(response.status).toBe(200);
        expect((await json<{ monthlySavedGoalGrams: number }>(response)).monthlySavedGoalGrams).toBe(14000);
        expect((await json<AuthBody>(await api.call('/api/auth/session', { cookie }))).user.displayName).toBe('Camille');
        expect((await readState(cookie)).plannedTrips).toHaveLength(1);
    });

    it('refuse une valeur hors bornes, avec le message du contrat', async () => {
        const cookie = await api.register('bornes@lyon.fr');
        const response = await api.putProfile(cookie, { ...DEFAULT_PROFILE, maxWalkMinutes: 240 });

        expect(response.status).toBe(422);
        expect((await json<{ error: string }>(response)).error).not.toBe('Requete invalide.');
    });

    it('le profil se lit seul', async () => {
        const cookie = await api.register('lecture-profil@lyon.fr');
        await api.putProfile(cookie, { ...DEFAULT_PROFILE, displayName: 'Camille' });

        expect((await json<{ displayName: string }>(await api.call('/api/me/profile', { cookie }))).displayName).toBe('Camille');
    });
});
