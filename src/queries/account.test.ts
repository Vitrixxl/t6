// Cache du compte et commandes granulaires, testes sans React. Chaque cas suit
// directement la requête d'une ressource puis la réponse appliquée à son cache.
import { MutationObserver, QueryObserver, type MutationObserverOptions, type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from '../test/harness';
import { DEFAULT_PROFILE, type Session } from '../contracts';
import { summarizeCarbon } from '../lib/carbon';
import { createPlannedTrip, createRecurringTrip, isRoutinePaused, setRecurringPaused, upcomingTrips } from '../lib/trips';
import { createSavedRouteRecord } from '../lib/savedRoutes';
import type { PlannedTrip, RecurringTrip, RouteOption } from '../types';
import { createQueryClient } from './client';
import { mutationKeys } from './keys';
import {
    cancelPlannedTripOptions,
    completePlannedTripOptions,
    deletePlannedTripOptions,
    plannedTripsQuery,
    readPlannedTrips,
    savePlannedTripOptions,
} from './planned-trips';
import { profileQuery, saveProfileOptions } from './profile';
import { cancelRecurringDateOptions, deleteRecurringTripOptions, readRecurringTrips, saveRecurringTripOptions } from './recurring-trips';
import { saveErrorFrom } from './save-error';
import { deleteSavedRouteOptions, readSavedRoutes, saveSavedRouteOptions, savedRoutesQuery } from './saved-routes';
import { deleteAccountOptions, logout, openSession, readSession, sessionQuery } from './session';
import { clearTripHistoryOptions, readTripRecords } from './trip-records';

const SOURCE = {
    label: 'Domicile -> Travail',
    origin: { label: 'Bellecour', lat: 45.7578, lon: 4.832 },
    destination: { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 },
    modes: ['walk', 'transit'] as Array<'walk' | 'transit'>,
    distanceKm: 2.4,
    durationMinutes: 14,
    carbonGrams: 96,
    carbonSavedGrams: 336,
};

const OPTION: RouteOption = {
    id: 'bike',
    title: 'Vélo',
    summary: '',
    modes: ['walk', 'bike'],
    legs: [],
    path: [],
    distanceKm: 2.4,
    durationMinutes: 12,
    carbonGrams: 10,
    carbonSavedGrams: 420,
    carbonReference: { distanceKm: 3, carbonGrams: 426, factorVersion: 'test-car-factor' },
    reliabilityScore: 86,
    score: 84,
    accessible: true,
    warnings: [],
    instructions: [],
};

const EVERY_DAY = { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], departureTime: '23:59', returnTime: null };

function session(overrides: Partial<Session['state']> = {}): Session {
    return {
        user: { id: 'user-1', email: 'a@b.fr', displayName: 'Citoyen', profile: DEFAULT_PROFILE },
        state: { profile: DEFAULT_PROFILE, tripRecords: [], plannedTrips: [], recurringTrips: [], savedRoutes: [], ...overrides },
    };
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type FetchMock = ReturnType<typeof vi.fn<FetchHandler>>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsedBody(init?: RequestInit): Record<string, unknown> {
    const value: unknown = JSON.parse(String(init?.body));
    if (!isRecord(value)) {
        throw new Error('Le faux serveur attend un objet JSON.');
    }
    return value;
}

function lastPathPart(url: string): string {
    return decodeURIComponent(url.split('/').at(-1) ?? '');
}

/** Faux serveur granulaire : le PUT rend seulement la ressource adressee. */
const resourceServer: FetchHandler = (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (method === 'DELETE') {
        return Promise.resolve(jsonResponse({ ok: true }));
    }
    if (method !== 'PUT') {
        return Promise.resolve(jsonResponse([]));
    }
    if (url.endsWith('/api/me/profile')) {
        return Promise.resolve(jsonResponse(parsedBody(init)));
    }
    if (url.endsWith('/completion')) {
        const id = decodeURIComponent(url.split('/').at(-2) ?? '');
        const completedAt = '2026-09-02T07:00:00.000Z';
        const plannedTrip = { ...futureTrip(), id, status: 'done', completedAt };
        return Promise.resolve(
            jsonResponse({
                plannedTrip,
                tripRecord: {
                    id: `trip:${id}`,
                    userId: 'user-1',
                    routeTitle: plannedTrip.label,
                    modes: plannedTrip.modes,
                    distanceKm: plannedTrip.distanceKm,
                    durationMinutes: plannedTrip.durationMinutes,
                    carbonGrams: plannedTrip.carbonGrams,
                    carbonSavedGrams: plannedTrip.carbonSavedGrams,
                    createdAt: completedAt,
                },
            }),
        );
    }
    return Promise.resolve(jsonResponse({ id: lastPathPart(url), userId: 'user-1', ...parsedBody(init) }));
};

interface SentRequest {
    path: string;
    method: string;
    body: Record<string, unknown> | null;
}

function sentRequests(spy: FetchMock): SentRequest[] {
    return spy.mock.calls
        .filter(([, init]) => init?.method === 'PUT' || init?.method === 'DELETE')
        .map(([url, init]) => ({
            path: String(url),
            method: init?.method ?? 'GET',
            body: init?.body ? parsedBody(init) : null,
        }));
}

function futureTrip(): PlannedTrip {
    return createPlannedTrip('user-1', SOURCE, new Date(Date.now() + 3_600_000));
}

let client: QueryClient;
let fetchSpy: FetchMock;

beforeEach(() => {
    client = createQueryClient();
    fetchSpy = vi.fn(resourceServer);
    vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
    client.clear();
    vi.unstubAllGlobals();
});

function write<Result, Variables, Context>(options: MutationObserverOptions<Result, Error, Variables, Context>, variables: Variables): Promise<void> {
    return new MutationObserver(client, options)
        .mutate(variables)
        .then(() => undefined, () => undefined);
}

function saveError(): string {
    return saveErrorFrom(
        client.getMutationCache().findAll({ mutationKey: mutationKeys.account }).map((mutation) => ({
            status: mutation.state.status,
            message: mutation.state.error?.message ?? '',
            submittedAt: mutation.state.submittedAt,
        })),
    );
}

describe('session', () => {
    it('amorce chaque partie sans relire ni envoyer', () => {
        const trip = futureTrip();
        openSession(client, session({ plannedTrips: [trip] }));

        expect(readSession(client)?.user.email).toBe('a@b.fr');
        expect(new QueryObserver(client, plannedTripsQuery(client)).getCurrentResult().data).toEqual([trip]);
        expect(readPlannedTrips(client)).toEqual([trip]);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('reprend une session et rend null sans session valide', async () => {
        fetchSpy.mockResolvedValueOnce(jsonResponse(session()));
        expect((await client.fetchQuery(sessionQuery))?.user.id).toBe('user-1');

        const fresh = createQueryClient();
        fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Session expirée.' }, 401));
        expect(await fresh.fetchQuery(sessionQuery)).toBeNull();
    });

    it('révoque la session et vide le compte à la déconnexion', async () => {
        openSession(client, session({ plannedTrips: [futureTrip()] }));
        client.setQueryData(['account', 'plannedTrips'], [futureTrip()]);

        await logout(client);

        expect(readSession(client)).toBeNull();
        expect(readPlannedTrips(client)).toEqual([]);
        expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toContain('/api/auth/logout');
    });

    it('garde la session si l’effacement du compte echoue', async () => {
        openSession(client, session());
        fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Serveur indisponible.' }, 500));

        await new MutationObserver(client, deleteAccountOptions(client)).mutate().catch(() => undefined);

        expect(readSession(client)).not.toBeNull();
        expect(saveError()).toBe('Serveur indisponible.');
    });
});

describe('commandes granulaires', () => {
    beforeEach(() => {
        openSession(client, session());
    });

    it('envoie un seul trajet programmé, sans id ni proprietaire dans le corps', async () => {
        const trip = futureTrip();
        await write(savePlannedTripOptions(client), trip);

        expect(upcomingTrips(readPlannedTrips(client))).toHaveLength(1);
        const [request] = sentRequests(fetchSpy);
        expect(request.path).toBe(`/api/trips/planned/${trip.id}`);
        expect(request.body).not.toHaveProperty('id');
        expect(request.body).not.toHaveProperty('userId');
    });

    it('termine un trajet par un seul endpoint et réconcilie les deux vues', async () => {
        const trip = futureTrip();
        openSession(client, session({ plannedTrips: [trip] }));

        await write(completePlannedTripOptions(client), trip);

        const plannedTrips = readPlannedTrips(client);
        const tripRecords = readTripRecords(client);
        expect(plannedTrips[0].status).toBe('done');
        expect(tripRecords).toHaveLength(1);
        expect(summarizeCarbon(tripRecords, [], DEFAULT_PROFILE.carbonGoalGramsPerWeek).totalSavedGrams).toBe(336);
        expect(sentRequests(fetchSpy)).toEqual([
            { path: `/api/trips/planned/${trip.id}/completion`, method: 'PUT', body: null },
        ]);
    });

    it('annule puis supprime sans jamais envoyer la collection', async () => {
        const trip = futureTrip();
        openSession(client, session({ plannedTrips: [trip] }));
        const cancelled = { ...trip, status: 'cancelled' as const, completedAt: null };

        const saving = write(savePlannedTripOptions(client), cancelled);
        const deleting = write(deletePlannedTripOptions(client), cancelled);
        await Promise.all([saving, deleting]);

        expect(readPlannedTrips(client)).toHaveLength(0);

        const requests = sentRequests(fetchSpy);
        expect(requests.map(({ method }) => method)).toEqual(['PUT', 'DELETE']);
        expect(requests.map(({ path }) => path).every((path) => path.endsWith(`/${trip.id}`))).toBe(true);
        expect(requests[0].body).not.toBeArray();
    });

    it('crée, met en pause puis supprime une routine seule', async () => {
        const routine = createRecurringTrip('user-1', SOURCE, EVERY_DAY);
        await write(saveRecurringTripOptions(client), routine);
        const paused = setRecurringPaused([routine], routine.id, true)[0] ?? routine;
        await write(saveRecurringTripOptions(client), paused);
        expect(isRoutinePaused(readRecurringTrips(client)[0])).toBe(true);
        await write(deleteRecurringTripOptions(client), paused);

        expect(readRecurringTrips(client)).toHaveLength(0);
        expect(sentRequests(fetchSpy).map(({ path }) => path)).toEqual([
            `/api/trips/recurring/${routine.id}`,
            `/api/trips/recurring/${routine.id}`,
            `/api/trips/recurring/${routine.id}`,
        ]);
    });

    it('enregistre sans doublon puis supprime un itinéraire', async () => {
        const record = createSavedRouteRecord('user-1', SOURCE.origin, SOURCE.destination, OPTION);
        await write(saveSavedRouteOptions(client), record);
        await write(saveSavedRouteOptions(client), record);
        expect(readSavedRoutes(client)).toHaveLength(1);

        await write(deleteSavedRouteOptions(client), record.id);
        expect(readSavedRoutes(client)).toHaveLength(0);
    });

    it('envoie le profil seul et efface l’historique par DELETE explicite', async () => {
        const profile = { ...DEFAULT_PROFILE, displayName: 'Nadia' };
        await write(saveProfileOptions(client), profile);
        await write(clearTripHistoryOptions(client), undefined);

        expect(client.getQueryData(profileQuery(client).queryKey)?.displayName).toBe('Nadia');
        expect(sentRequests(fetchSpy).map(({ path, method }) => `${method} ${path}`)).toEqual([
            'PUT /api/me/profile',
            'DELETE /api/trips/history',
        ]);
    });
});

describe('refus et rafales', () => {
    beforeEach(() => {
        openSession(client, session());
    });

    it('signale un refus puis l’efface au prochain succès', async () => {
        fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Requête invalide.' }, 422));
        await write(clearTripHistoryOptions(client), undefined);
        expect(saveError()).toBe('Requête invalide.');

        await write(clearTripHistoryOptions(client), undefined);
        expect(saveError()).toBe('');
    });

    it('relit uniquement la vue concernée après un serveur injoignable', async () => {
        const observer = new QueryObserver(client, savedRoutesQuery(client));
        const unsubscribe = observer.subscribe(() => undefined);
        const record = createSavedRouteRecord('user-1', SOURCE.origin, SOURCE.destination, OPTION);
        fetchSpy.mockImplementation((_url, init) =>
            init?.method === 'PUT' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(jsonResponse([])),
        );

        await write(saveSavedRouteOptions(client), record);

        expect(saveError()).toContain('injoignable');
        expect(readSavedRoutes(client)).toHaveLength(0);
        const reads = fetchSpy.mock.calls.filter(([, init]) => init?.method !== 'PUT');
        expect(reads.map(([url]) => String(url))).toEqual(['/api/saved-routes']);
        unsubscribe();
    });

    it('sérialise des commandes différentes sans mélanger leurs corps', async () => {
        const trip = futureTrip();
        const record = createSavedRouteRecord('user-1', SOURCE.origin, SOURCE.destination, OPTION);

        await Promise.all([
            write(savePlannedTripOptions(client), trip),
            write(saveSavedRouteOptions(client), record),
            write(saveProfileOptions(client), { ...DEFAULT_PROFILE, displayName: 'Final' }),
        ]);

        const requests = sentRequests(fetchSpy);
        expect(requests.map(({ path }) => path)).toEqual([
            `/api/trips/planned/${trip.id}`,
            `/api/saved-routes/${record.id}`,
            '/api/me/profile',
        ]);
        expect(requests.every(({ body }) => !Array.isArray(body))).toBe(true);
    });

    it('poursuit la rafale après un refus et garde le dernier succès visible', async () => {
        fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Requête invalide.' }, 422));
        const record = createSavedRouteRecord('user-1', SOURCE.origin, SOURCE.destination, OPTION);

        await Promise.all([write(clearTripHistoryOptions(client), undefined), write(saveSavedRouteOptions(client), record)]);

        expect(sentRequests(fetchSpy).map(({ path }) => path)).toEqual(['/api/trips/history', `/api/saved-routes/${record.id}`]);
        expect(saveError()).toBe('');
    });
});


describe('cache après annulation', () => {
    it('retire la contribution carbone même si seul l’état de connexion l’avait amorcée', async () => {
        const trip = { ...futureTrip(), status: 'done' as const, completedAt: '2026-09-02T07:00:00Z' };
        const record = {
            id: `trip:${trip.id}`, userId: trip.userId, routeTitle: trip.label, modes: trip.modes,
            distanceKm: trip.distanceKm, durationMinutes: trip.durationMinutes,
            carbonGrams: trip.carbonGrams, carbonSavedGrams: trip.carbonSavedGrams, createdAt: trip.completedAt,
        };
        openSession(client, session({ plannedTrips: [trip], tripRecords: [record] }));
        fetchSpy.mockResolvedValueOnce(jsonResponse({ ...trip, status: 'cancelled', completedAt: null }));
        await write(cancelPlannedTripOptions(client), trip);
        expect(readPlannedTrips(client)[0]?.status).toBe('cancelled');
        expect(readTripRecords(client)).toEqual([]);
        expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(`/api/trips/planned/${trip.id}/cancellation`);
    });

    it('envoie seulement les sens de la date annulée et applique la réponse serveur', async () => {
        const trip = createRecurringTrip('user-1', SOURCE, EVERY_DAY);
        openSession(client, session({ recurringTrips: [trip] }));
        const saved: RecurringTrip = { ...trip, cancelledPassages: [{ date: '2026-09-01', direction: 'return' }] };
        fetchSpy.mockResolvedValueOnce(jsonResponse(saved));
        await write(cancelRecurringDateOptions(client), { id: trip.id, date: '2026-09-01', directions: ['return'] });
        expect(parsedBody(fetchSpy.mock.calls[0]?.[1])).toEqual({ directions: ['return'] });
        expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(`/cancellations/2026-09-01`);
        expect(readRecurringTrips(client)).toEqual([saved]);
    });

    it('garde le bilan et rend le refus visible si l’annulation échoue', async () => {
        const trip = createRecurringTrip('user-1', SOURCE, EVERY_DAY);
        openSession(client, session({ recurringTrips: [trip] }));
        fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Passage introuvable.' }, 404));
        await write(cancelRecurringDateOptions(client), { id: trip.id, date: '2026-09-01', directions: ['outbound'] });
        expect(readRecurringTrips(client)).toEqual([trip]);
        expect(saveError()).toBe('Passage introuvable.');
    });
});
