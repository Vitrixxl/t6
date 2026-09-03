// L'etat du compte, teste sans React : un store jotai, des actions, et le
// serveur remplace par un fetch simule. Chaque test verifie l'etat en memoire
// ET ce qui est parti au serveur : quelle route, avec quel corps.
import { createStore } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from '../test/harness';
import type { Session } from '../lib/api/account';
import { DEFAULT_PROFILE } from '../lib/auth/defaults';
import { createRecurringTrip, isRoutinePaused } from '../lib/trips';
import type { PlannedTrip, RouteOption } from '../types';
import {
  accountStateAtom,
  activitySummaryAtom,
  cancelTripAtom,
  carbonSummaryAtom,
  clearTripHistoryAtom,
  deleteAccountAtom,
  deleteSavedRouteAtom,
  logoutAtom,
  markTripDoneAtom,
  openSessionAtom,
  pendingSaves,
  planSourceAtom,
  removeRecurringAtom,
  removeTripAtom,
  saveErrorAtom,
  saveRouteAtom,
  sessionAtom,
  setProfileAtom,
  submitPlanAtom,
  toggleRecurringPausedAtom,
  tripsHubAtom,
  upcomingAtom,
  userAtom,
} from './index';

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
  reliabilityScore: 86,
  score: 84,
  accessible: true,
  warnings: [],
  instructions: [],
};

function session(overrides: Partial<Session['state']> = {}): Session {
  return {
    user: { id: 'user-1', email: 'a@b.fr', displayName: 'Citoyen', profile: DEFAULT_PROFILE },
    state: { profile: DEFAULT_PROFILE, tripRecords: [], plannedTrips: [], recurringTrips: [], savedRoutes: [], ...overrides },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Envois au serveur, dans l'ordre : la route et le corps. */
function sentPuts<T = unknown>(spy: ReturnType<typeof vi.spyOn>): Array<{ path: string; body: T }> {
  return (spy.mock.calls as Array<[string, RequestInit]>)
    .filter(([, init]) => init.method === 'PUT')
    .map(([url, init]) => ({ path: url, body: JSON.parse(String(init.body)) as T }));
}

function sentPaths(spy: ReturnType<typeof vi.spyOn>): string[] {
  return sentPuts(spy).map((put) => put.path);
}

function sentTo<T>(spy: ReturnType<typeof vi.spyOn>, path: string): T | undefined {
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

let store: ReturnType<typeof createStore>;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  store = createStore();
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}));
});

afterEach(async () => {
  await pendingSaves();
  vi.restoreAllMocks();
});

describe('session', () => {
  it('ouvre la session avec l etat rendu par le serveur, sans rien envoyer', async () => {
    store.set(openSessionAtom, session({ tripRecords: [] }));
    await pendingSaves();

    expect(store.get(userAtom).email).toBe('a@b.fr');
    expect(sentPuts(fetchSpy)).toHaveLength(0);
  });

  it('une routine ne cree aucun trajet a l ouverture : ses passages se comptent a la lecture', async () => {
    // Creee il y a huit jours, tous les jours a 00:01 : ses passages echus
    // comptent dans les objectifs sans qu'aucun trajet n'existe.
    const routine = createRecurringTrip(
      'user-1',
      SOURCE,
      { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], departureTime: '00:01', returnTime: null },
      new Date(Date.now() - 8 * 86_400_000),
    );
    store.set(openSessionAtom, session({ recurringTrips: [routine] }));
    await pendingSaves();

    expect(store.get(upcomingAtom)).toHaveLength(0);
    expect(store.get(activitySummaryAtom).recurringActiveCount).toBe(1);
    expect(store.get(activitySummaryAtom).doneThisWeek).toBeGreaterThan(0);
    expect(store.get(carbonSummaryAtom).trips).toBe(store.get(activitySummaryAtom).doneThisWeek);
    expect(sentPuts(fetchSpy)).toHaveLength(0);
  });

  it('la deconnexion revoque la session et vide l etat', async () => {
    store.set(openSessionAtom, session({ tripRecords: [] }));

    store.set(logoutAtom);

    expect(store.get(sessionAtom)).toBeNull();
    expect(store.get(accountStateAtom).plannedTrips).toEqual([]);
    expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toContain('/api/auth/logout');
  });

  it('l effacement ferme la session quand le serveur accepte, la garde sinon', async () => {
    store.set(openSessionAtom, session());
    await store.set(deleteAccountAtom);
    expect(store.get(sessionAtom)).toBeNull();

    store.set(openSessionAtom, session());
    fetchSpy.mockResolvedValue(jsonResponse({ error: 'Serveur indisponible.' }, 500));
    await store.set(deleteAccountAtom);
    expect(store.get(sessionAtom)).not.toBeNull();
    expect(store.get(saveErrorAtom)).toBe('Serveur indisponible.');
  });
});

describe('planification', () => {
  beforeEach(() => {
    store.set(openSessionAtom, session());
    store.set(planSourceAtom, SOURCE);
  });

  it('un trajet date entre dans l etat, part au serveur et ouvre l onglet a venir', async () => {
    const tab = store.set(submitPlanAtom, { kind: 'once', label: 'Reunion', scheduledFor: new Date(Date.now() + 86_400_000) });
    await pendingSaves();

    expect(tab).toBe('upcoming');
    expect(store.get(upcomingAtom)).toHaveLength(1);
    expect(store.get(upcomingAtom)[0].label).toBe('Reunion');
    expect(store.get(planSourceAtom)).toBeNull();
    expect(store.get(tripsHubAtom)).toEqual({ open: true, tab: 'upcoming' });
    // Seule la liste des trajets programmes part : ni profil, ni historique.
    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/planned']);
    const sent = sentTo<unknown[]>(fetchSpy, '/api/trips/planned')!;
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty('userId');
  });

  it('une routine entre dans l etat, active des sa creation, et ouvre l onglet recurrents', async () => {
    const tab = store.set(submitPlanAtom, {
      kind: 'recurring',
      label: 'Boulot',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      departureTime: '23:59',
      returnTime: null,
    });
    await pendingSaves();

    expect(tab).toBe('recurring');
    expect(store.get(accountStateAtom).recurringTrips).toHaveLength(1);
    expect(store.get(accountStateAtom).recurringTrips[0].periods).toHaveLength(1);
    expect(store.get(upcomingAtom)).toHaveLength(0);
    expect(store.get(activitySummaryAtom).recurringActiveCount).toBe(1);
    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/recurring']);
    const sent = sentTo<unknown[]>(fetchSpy, '/api/trips/recurring')!;
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toHaveProperty('userId');
  });

  it('une soumission incomplete ne change rien', async () => {
    expect(store.set(submitPlanAtom, { kind: 'once', label: 'Sans date' })).toBeNull();
    await pendingSaves();

    expect(store.get(upcomingAtom)).toHaveLength(0);
    expect(sentPuts(fetchSpy)).toHaveLength(0);
  });
});

describe('trajets', () => {
  it('marquer fait alimente l historique carbone et n envoie que les deux listes touchees', async () => {
    const trip = futureTrip();
    store.set(openSessionAtom, session({ plannedTrips: [trip] }));

    store.set(markTripDoneAtom, trip);
    await pendingSaves();

    const state = store.get(accountStateAtom);
    expect(state.plannedTrips[0].status).toBe('done');
    expect(state.tripRecords).toHaveLength(1);
    expect(store.get(carbonSummaryAtom).totalSavedGrams).toBe(SOURCE.carbonSavedGrams);
    expect(store.get(activitySummaryAtom).doneThisWeek).toBe(1);
    expect(sentPaths(fetchSpy).sort()).toEqual(['/api/trips/history', '/api/trips/planned']);
    expect(sentTo<unknown[]>(fetchSpy, '/api/trips/history')).toHaveLength(1);
  });

  it('annuler puis supprimer : une seule liste touchee, un seul envoi avec l etat final', async () => {
    const trip = futureTrip();
    store.set(openSessionAtom, session({ plannedTrips: [trip] }));

    store.set(cancelTripAtom, trip);
    expect(store.get(accountStateAtom).plannedTrips[0].status).toBe('cancelled');
    expect(store.get(upcomingAtom)).toHaveLength(0);

    store.set(removeTripAtom, trip);
    expect(store.get(accountStateAtom).plannedTrips).toHaveLength(0);
    await pendingSaves();
    // Deux actions avant le premier envoi : le lot les coalesce.
    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/planned']);
    expect(sentTo<unknown[]>(fetchSpy, '/api/trips/planned')).toHaveLength(0);
  });

  it('mettre une routine en pause clot sa periode, la reprendre en ouvre une nouvelle', async () => {
    const routine = createRecurringTrip('user-1', SOURCE, { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], departureTime: '23:59', returnTime: null });
    store.set(openSessionAtom, session({ recurringTrips: [routine] }));
    expect(store.get(activitySummaryAtom).recurringActiveCount).toBe(1);

    store.set(toggleRecurringPausedAtom, routine);
    const paused = store.get(accountStateAtom).recurringTrips[0];
    expect(isRoutinePaused(paused)).toBe(true);
    expect(store.get(activitySummaryAtom).recurringActiveCount).toBe(0);

    store.set(toggleRecurringPausedAtom, paused);
    const resumed = store.get(accountStateAtom).recurringTrips[0];
    expect(isRoutinePaused(resumed)).toBe(false);
    expect(resumed.periods).toHaveLength(2);
    await pendingSaves();
    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/recurring']);
    expect(sentTo<{ periods: unknown[] }[]>(fetchSpy, '/api/trips/recurring')?.[0].periods).toHaveLength(2);
  });

  it('supprimer une routine ne touche pas aux trajets dates', async () => {
    const routine = createRecurringTrip('user-1', SOURCE, { daysOfWeek: [0, 1, 2, 3, 4, 5, 6], departureTime: '23:59', returnTime: null });
    const trip = futureTrip();
    store.set(openSessionAtom, session({ recurringTrips: [routine], plannedTrips: [trip] }));

    store.set(removeRecurringAtom, routine);
    await pendingSaves();

    const state = store.get(accountStateAtom);
    expect(state.recurringTrips).toHaveLength(0);
    expect(state.plannedTrips).toHaveLength(1);
    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/recurring']);
    expect(sentTo<unknown[]>(fetchSpy, '/api/trips/recurring')).toHaveLength(0);
  });
});

describe('itineraires enregistres, profil, historique', () => {
  beforeEach(() => {
    store.set(openSessionAtom, session());
  });

  it('enregistre sans doublon puis supprime', async () => {
    const input = { option: OPTION, origin: SOURCE.origin, destination: SOURCE.destination };
    store.set(saveRouteAtom, input);
    store.set(saveRouteAtom, input);
    expect(store.get(accountStateAtom).savedRoutes).toHaveLength(1);

    store.set(deleteSavedRouteAtom, store.get(accountStateAtom).savedRoutes[0].id);
    await pendingSaves();
    expect(store.get(accountStateAtom).savedRoutes).toHaveLength(0);
  });

  it('le profil est borne avant envoi et le nom affiche suit', async () => {
    store.set(setProfileAtom, { ...DEFAULT_PROFILE, displayName: '<Nadia>', maxWalkMinutes: 999 });
    await pendingSaves();

    expect(store.get(userAtom).displayName).toBe('Nadia');
    expect(store.get(userAtom).profile.maxWalkMinutes).toBe(45);
    expect(sentPaths(fetchSpy)).toEqual(['/api/me/profile']);
    expect(sentTo<{ maxWalkMinutes: number }>(fetchSpy, '/api/me/profile')?.maxWalkMinutes).toBe(45);
  });

  it('effacer l historique', async () => {
    const trip = futureTrip();
    store.set(openSessionAtom, session({ plannedTrips: [trip] }));
    store.set(markTripDoneAtom, trip);
    expect(store.get(accountStateAtom).tripRecords).toHaveLength(1);

    store.set(clearTripHistoryAtom);
    await pendingSaves();
    expect(store.get(accountStateAtom).tripRecords).toHaveLength(0);
    expect(sentTo<unknown[]>(fetchSpy, '/api/trips/history')).toHaveLength(0);
  });
});

describe('envoi au serveur', () => {
  beforeEach(() => {
    store.set(openSessionAtom, session());
  });

  it('un refus du serveur est signale, puis efface au prochain succes', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Requete invalide.' }, 422));
    store.set(clearTripHistoryAtom);
    await pendingSaves();
    expect(store.get(saveErrorAtom)).toBe('Requete invalide.');

    store.set(clearTripHistoryAtom);
    await pendingSaves();
    expect(store.get(saveErrorAtom)).toBe('');
  });

  it('un serveur injoignable est signale sans perdre l etat en memoire', async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const input = { option: OPTION, origin: SOURCE.origin, destination: SOURCE.destination };
    store.set(saveRouteAtom, input);
    await pendingSaves();

    expect(store.get(saveErrorAtom)).toContain('injoignable');
    expect(store.get(accountStateAtom).savedRoutes).toHaveLength(1);
  });

  it('des actions en rafale forment un seul lot : chaque partie part une fois, dans son etat final', async () => {
    const trip = futureTrip();
    store.set(openSessionAtom, session({ plannedTrips: [trip] }));
    store.set(markTripDoneAtom, trip);
    store.set(saveRouteAtom, { option: OPTION, origin: SOURCE.origin, destination: SOURCE.destination });
    store.set(setProfileAtom, { ...DEFAULT_PROFILE, displayName: 'Final' });
    await pendingSaves();

    expect(sentPaths(fetchSpy).sort()).toEqual([
      '/api/me/profile',
      '/api/saved-routes',
      '/api/trips/history',
      '/api/trips/planned',
    ]);
    expect(sentTo<{ displayName: string }>(fetchSpy, '/api/me/profile')?.displayName).toBe('Final');
    expect(sentTo<unknown[]>(fetchSpy, '/api/saved-routes')).toHaveLength(1);
    expect(sentTo<unknown[]>(fetchSpy, '/api/trips/history')).toHaveLength(1);
  });

  it('une partie refusee repart avec la prochaine action, meme si celle-ci ne la touche pas', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Requete invalide.' }, 422));
    store.set(clearTripHistoryAtom);
    await pendingSaves();
    expect(store.get(saveErrorAtom)).toBe('Requete invalide.');

    store.set(saveRouteAtom, { option: OPTION, origin: SOURCE.origin, destination: SOURCE.destination });
    await pendingSaves();

    expect(store.get(saveErrorAtom)).toBe('');
    const paths = sentPaths(fetchSpy);
    expect(paths[0]).toBe('/api/trips/history');
    expect(paths.slice(1).sort()).toEqual(['/api/saved-routes', '/api/trips/history']);
  });

  it('une partie refusee ne survit pas a la session qui l a produite', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ error: 'Requete invalide.' }, 422));
    store.set(clearTripHistoryAtom);
    await pendingSaves();

    store.set(logoutAtom);
    store.set(openSessionAtom, session());
    store.set(saveRouteAtom, { option: OPTION, origin: SOURCE.origin, destination: SOURCE.destination });
    await pendingSaves();

    expect(sentPaths(fetchSpy)).toEqual(['/api/trips/history', '/api/saved-routes']);
  });
});
