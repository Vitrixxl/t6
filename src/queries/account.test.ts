// L'etat du compte, teste sans React : un cache de requetes, les actions
// pures et la mutation qui les ecrit, le serveur remplace par un fetch
// simule. Chaque test verifie le cache ET ce qui est parti au serveur :
// quelle route, avec quel corps.
import { MutationObserver, QueryObserver, type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from '../test/harness';
import { DEFAULT_PROFILE, type Session } from '../contracts';
import { summarizeCarbon } from '../lib/carbon';
import { createRecurringTrip, isRoutinePaused, upcomingTrips } from '../lib/trips';
import type { PlannedTrip, RouteOption } from '../types';
import { accountPartQuery, accountWriteOptions, readAccountPart, readAccountState, stageAccountWrite, type AccountUpdate } from './account';
import { createQueryClient } from './client';
import { mutationKeys } from './keys';
import { cancelTrip, completeTrip, planTrip, removeTrip } from './planned-trips';
import { updateProfile } from './profile';
import { createRoutine, removeRoutine, toggleRoutinePaused } from './recurring-trips';
import { saveErrorFrom } from './save-error';
import { deleteSavedRoute, saveRoute } from './saved-routes';
import { deleteAccountOptions, logout, openSession, readSession, sessionQuery } from './session';
import { clearTripHistory } from './trip-records';

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
  title: 'Velo',
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

const ROUTE_INPUT = { option: OPTION, origin: SOURCE.origin, destination: SOURCE.destination };
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

/** Le serveur simule : un PUT rend la liste qu'il a recue, comme le vrai. */
const echoServer: FetchHandler = (_url, init) =>
  Promise.resolve(init?.method === 'PUT' ? jsonResponse(JSON.parse(String(init.body))) : jsonResponse({}));

/** Envois au serveur, dans l'ordre : la route et le corps. */
function sentPuts<T = unknown>(spy: FetchMock): Array<{ path: string; body: T }> {
  return spy.mock.calls
    .filter(([, init]) => init?.method === 'PUT')
    .map(([url, init]) => ({ path: String(url), body: JSON.parse(String(init?.body)) as T }));
}

function sentPaths(spy: FetchMock): string[] {
  return sentPuts(spy).map((put) => put.path);
}

function sentTo<T>(spy: FetchMock, path: string): T | undefined {
  return sentPuts<T>(spy).find((put) => put.path === path)?.body;
}

/** Un trajet a venir dans l'etat, pret a etre marque fait. */
function futureTrip(): PlannedTrip {
  const scheduledFor = new Date(Date.now() + 3_600_000).toISOString();
  return {
    id: 'trip-1',
    userId: 'user-1',
    ...SOURCE,
    scheduledFor,
    status: 'planned',
    createdAt: new Date().toISOString(),
    completedAt: null,
  };
}

let client: QueryClient;
let fetchSpy: FetchMock;

beforeEach(() => {
  client = createQueryClient();
  fetchSpy = vi.fn(echoServer);
  vi.stubGlobal('fetch', fetchSpy);
});

afterEach(() => {
  client.clear();
  vi.unstubAllGlobals();
});

/** Ce que fait un hook d'action : afficher, puis envoyer. La promesse se conclut, refus compris. */
function write(update: AccountUpdate): Promise<void> {
  const changes = stageAccountWrite(client, update);
  if (!changes) {
    return Promise.resolve();
  }
  return new MutationObserver(client, accountWriteOptions(client))
    .mutate(changes)
    .then(() => undefined, () => undefined);
}

/** Ce que la banniere affiche : le dernier envoi conclu, s'il a ete refuse. */
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
  it('l ouverture de session amorce chaque partie sans relire ni envoyer', () => {
    const trip = futureTrip();
    openSession(client, session({ plannedTrips: [trip] }));

    expect(readSession(client)?.user.email).toBe('a@b.fr');
    // Une partie observee par un composant part de ce que la session a rendu.
    const observed = new QueryObserver(client, accountPartQuery(client, 'plannedTrips')).getCurrentResult();
    expect(observed.data).toEqual([trip]);
    expect(readAccountState(client).plannedTrips).toEqual([trip]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('la reprise de session relit le serveur, et rend null sans session valide', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(session()));
    expect((await client.fetchQuery(sessionQuery))?.user.id).toBe('user-1');

    const fresh = createQueryClient();
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Session expiree.' }, 401));
    expect(await fresh.fetchQuery(sessionQuery)).toBeNull();
  });

  it('la deconnexion revoque la session et vide le compte', async () => {
    openSession(client, session({ plannedTrips: [futureTrip()] }));
    client.setQueryData(['account', 'plannedTrips'], [futureTrip()]);
    const observations: number[] = [];
    const observer = new QueryObserver(client, sessionQuery);
    const unsubscribe = observer.subscribe((result) => {
      if (result.data === null) {
        observations.push(client.getQueryCache().findAll({ queryKey: ['account'] }).length);
      }
    });

    await logout(client);

    expect(readSession(client)).toBeNull();
    expect(readAccountPart(client, 'plannedTrips')).toEqual([]);
    // Quand l'ecran apprend que la session est fermee, aucune ressource de
    // l'ancien compte ne doit encore produire une notification intermediaire.
    expect(observations).toEqual([0]);
    expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toContain('/api/auth/logout');
    unsubscribe();
  });

  it('l effacement ferme la session quand le serveur accepte, la garde sinon', async () => {
    openSession(client, session());
    await new MutationObserver(client, deleteAccountOptions(client)).mutate();
    expect(readSession(client)).toBeNull();

    openSession(client, session());
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Serveur indisponible.' }, 500));
    await new MutationObserver(client, deleteAccountOptions(client)).mutate().catch(() => undefined);
    expect(readSession(client)).not.toBeNull();
    expect(saveError()).toBe('Serveur indisponible.');
  });
});

describe('planification', () => {
  beforeEach(() => {
    openSession(client, session());
  });

  it('un trajet date entre dans le cache et part seul, sans proprietaire', async () => {
    await write((state) => planTrip(state, 'user-1', { ...SOURCE, label: 'Reunion' }, new Date(Date.now() + 86_400_000)));

    const upcoming = upcomingTrips(readAccountPart(client, 'plannedTrips'));
    expect(upcoming).toHaveLength(1);
    expect(upcoming[0].label).toBe('Reunion');
    // Seule la liste des trajets programmes part : ni profil, ni historique.
    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/planned']);
    const sent = sentTo<unknown[]>(fetchSpy, '/api/trips/planned')!;
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty('userId');
  });

  it('une routine entre dans le cache, active des sa creation, et part seule', async () => {
    await write((state) => createRoutine(state, 'user-1', { ...SOURCE, label: 'Boulot' }, EVERY_DAY));

    const routines = readAccountPart(client, 'recurringTrips');
    expect(routines).toHaveLength(1);
    expect(routines[0].periods).toHaveLength(1);
    expect(upcomingTrips(readAccountPart(client, 'plannedTrips'))).toHaveLength(0);
    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/recurring']);
    expect(sentTo<unknown[]>(fetchSpy, '/api/trips/recurring')![0]).not.toHaveProperty('userId');
  });
});

describe('trajets', () => {
  it('marquer fait alimente l historique carbone et n envoie que les deux listes touchees', async () => {
    const trip = futureTrip();
    openSession(client, session({ plannedTrips: [trip] }));

    await write((state) => completeTrip(state, trip));

    const state = readAccountState(client);
    expect(state.plannedTrips[0].status).toBe('done');
    expect(state.tripRecords).toHaveLength(1);
    expect(summarizeCarbon(state.tripRecords, state.recurringTrips, state.profile.carbonGoalGramsPerWeek).totalSavedGrams).toBe(
      SOURCE.carbonSavedGrams,
    );
    expect(sentPaths(fetchSpy).sort()).toEqual(['/api/trips/history', '/api/trips/planned']);
    expect(sentTo<unknown[]>(fetchSpy, '/api/trips/history')).toHaveLength(1);
  });

  it('annuler puis supprimer dans le meme tour : l ecran suit tout de suite, les envois partent dans l ordre', async () => {
    const trip = futureTrip();
    openSession(client, session({ plannedTrips: [trip] }));

    const cancelled = write((state) => cancelTrip(state, trip));
    expect(readAccountPart(client, 'plannedTrips')[0].status).toBe('cancelled');
    expect(upcomingTrips(readAccountPart(client, 'plannedTrips'))).toHaveLength(0);

    const removed = write((state) => removeTrip(state, trip));
    expect(readAccountPart(client, 'plannedTrips')).toHaveLength(0);
    await Promise.all([cancelled, removed]);

    // Deux envois, chacun avec l'etat que l'action a produit ; le second part
    // apres le premier, donc c'est lui que le serveur garde.
    const puts = sentPuts<Array<{ status: string }>>(fetchSpy);
    expect(puts.map((put) => put.path)).toEqual(['/api/trips/planned', '/api/trips/planned']);
    expect(puts[0].body[0].status).toBe('cancelled');
    expect(puts[1].body).toHaveLength(0);
  });

  it('mettre une routine en pause clot sa periode, la reprendre en ouvre une nouvelle', async () => {
    const routine = createRecurringTrip('user-1', SOURCE, EVERY_DAY);
    openSession(client, session({ recurringTrips: [routine] }));

    await write((state) => toggleRoutinePaused(state, routine));
    const paused = readAccountPart(client, 'recurringTrips')[0];
    expect(isRoutinePaused(paused)).toBe(true);

    await write((state) => toggleRoutinePaused(state, paused));
    const resumed = readAccountPart(client, 'recurringTrips')[0];
    expect(isRoutinePaused(resumed)).toBe(false);
    expect(resumed.periods).toHaveLength(2);
    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/recurring', '/api/trips/recurring']);
    expect(sentPuts<{ periods: unknown[] }[]>(fetchSpy).at(-1)?.body[0].periods).toHaveLength(2);
  });

  it('supprimer une routine ne touche pas aux trajets dates', async () => {
    const routine = createRecurringTrip('user-1', SOURCE, EVERY_DAY);
    const trip = futureTrip();
    openSession(client, session({ recurringTrips: [routine], plannedTrips: [trip] }));

    await write((state) => removeRoutine(state, routine));

    const state = readAccountState(client);
    expect(state.recurringTrips).toHaveLength(0);
    expect(state.plannedTrips).toHaveLength(1);
    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/recurring']);
    expect(sentTo<unknown[]>(fetchSpy, '/api/trips/recurring')).toHaveLength(0);
  });
});

describe('itineraires enregistres, profil, historique', () => {
  beforeEach(() => {
    openSession(client, session());
  });

  it('enregistre sans doublon puis supprime', async () => {
    await write((state) => saveRoute(state, 'user-1', ROUTE_INPUT));
    await write((state) => saveRoute(state, 'user-1', ROUTE_INPUT));
    expect(readAccountPart(client, 'savedRoutes')).toHaveLength(1);

    await write((state) => deleteSavedRoute(state, readAccountPart(client, 'savedRoutes')[0].id));
    expect(readAccountPart(client, 'savedRoutes')).toHaveLength(0);
  });

  it('le profil part tel quel vers sa route, et le nom affiche suit', async () => {
    await write(() => updateProfile({ ...DEFAULT_PROFILE, displayName: 'Nadia', maxWalkMinutes: 45 }));

    expect(readAccountPart(client, 'profile').displayName).toBe('Nadia');
    expect(sentPaths(fetchSpy)).toEqual(['/api/me/profile']);
    expect(sentTo<{ maxWalkMinutes: number }>(fetchSpy, '/api/me/profile')?.maxWalkMinutes).toBe(45);
  });

  it('effacer l historique', async () => {
    const trip = futureTrip();
    openSession(client, session({ plannedTrips: [trip] }));
    await write((state) => completeTrip(state, trip));
    expect(readAccountPart(client, 'tripRecords')).toHaveLength(1);

    await write(clearTripHistory);
    expect(readAccountPart(client, 'tripRecords')).toHaveLength(0);
    expect(sentPuts<unknown[]>(fetchSpy).at(-1)?.body).toHaveLength(0);
  });
});

describe('envoi au serveur', () => {
  beforeEach(() => {
    openSession(client, session());
  });

  it('un refus du serveur est signale, puis efface au prochain succes', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Requete invalide.' }, 422));
    await write(clearTripHistory);
    expect(saveError()).toBe('Requete invalide.');

    await write(clearTripHistory);
    expect(saveError()).toBe('');
  });

  it('un serveur injoignable est signale, et l ecran revient a ce que le serveur tient', async () => {
    // Un composant observe la liste : c'est lui qui recoit la relecture.
    const observer = new QueryObserver(client, accountPartQuery(client, 'savedRoutes'));
    const unsubscribe = observer.subscribe(() => undefined);
    const unreachableOnWrite: FetchHandler = (_url, init) =>
      init?.method === 'PUT' ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(jsonResponse([]));
    fetchSpy.mockImplementation(unreachableOnWrite);

    await write((state) => saveRoute(state, 'user-1', ROUTE_INPUT));

    expect(saveError()).toContain('injoignable');
    expect(readAccountPart(client, 'savedRoutes')).toHaveLength(0);
    const reads = fetchSpy.mock.calls.filter(([, init]) => init?.method !== 'PUT');
    expect(reads.map(([url]) => String(url))).toEqual(['/api/saved-routes']);
    unsubscribe();
  });

  it('des actions en rafale partent une par une, dans l ordre, chacune avec l etat qu elle a produit', async () => {
    const trip = futureTrip();
    openSession(client, session({ plannedTrips: [trip] }));

    await Promise.all([
      write((state) => completeTrip(state, trip)),
      write((state) => saveRoute(state, 'user-1', ROUTE_INPUT)),
      write(() => updateProfile({ ...DEFAULT_PROFILE, displayName: 'Final' })),
    ]);

    const paths = sentPaths(fetchSpy);
    expect(paths.slice(0, 2).sort()).toEqual(['/api/trips/history', '/api/trips/planned']);
    expect(paths.slice(2)).toEqual(['/api/saved-routes', '/api/me/profile']);
    expect(sentTo<{ displayName: string }>(fetchSpy, '/api/me/profile')?.displayName).toBe('Final');
    expect(sentTo<unknown[]>(fetchSpy, '/api/saved-routes')).toHaveLength(1);
    expect(sentTo<unknown[]>(fetchSpy, '/api/trips/history')).toHaveLength(1);
  });

  it('un refus n arrete pas la rafale : l action suivante part, et son succes efface le refus', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Requete invalide.' }, 422));

    await Promise.all([write(clearTripHistory), write((state) => saveRoute(state, 'user-1', ROUTE_INPUT))]);

    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/history', '/api/saved-routes']);
    expect(saveError()).toBe('');
  });

  it('un refus ne survit pas a la session qui l a produite', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Requete invalide.' }, 422));
    await write(clearTripHistory);
    expect(saveError()).toBe('Requete invalide.');

    await logout(client);
    openSession(client, session());
    await write((state) => saveRoute(state, 'user-1', ROUTE_INPUT));

    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/history', '/api/saved-routes']);
    expect(saveError()).toBe('');
  });
});
