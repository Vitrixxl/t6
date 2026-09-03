import { afterEach, describe, expect, it, vi } from '../../test/harness';
import { discardPending, hasPending, markDirty } from './dirty';
import { cacheSessionUser, setActiveSessionId } from './session';
import { adoptRemoteSession, pushState } from './sync';
import { DEFAULT_PROFILE } from '../auth/defaults';
import { loadTripHistory, saveTripRecord } from '../carbon';
import type { SessionUser, TripRecord } from '../../types';

const USER: SessionUser = { id: 'user-1', email: 'a@b.fr', displayName: 'Test', profile: DEFAULT_PROFILE };

const RECORD: TripRecord = {
  id: 'trip-1',
  userId: USER.id,
  routeTitle: 'Velo + metro',
  modes: ['bike', 'transit'],
  distanceKm: 5.2,
  durationMinutes: 22,
  carbonGrams: 136,
  carbonSavedGrams: 900,
  createdAt: '2026-09-01T08:00:00.000Z',
};

function openSession(): void {
  cacheSessionUser(USER);
  setActiveSessionId(USER.id);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pushState', () => {
  it('ne fait rien quand l etat local n a pas change', async () => {
    openSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(await pushState(USER.id)).toBe('clean');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('envoie l etat complet sans proprietaire, puis efface la marque', async () => {
    openSession();
    saveTripRecord(RECORD); // ecrit localement et marque l'etat a envoyer
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({}));

    const outcome = await pushState(USER.id);

    expect(outcome).toBe('pushed');
    expect(hasPending(USER.id)).toBe(false);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/state');
    expect(init.method).toBe('PUT');
    const sent = JSON.parse(String(init.body)) as { profile: unknown; tripRecords: Record<string, unknown>[] };
    expect(sent.profile).toEqual(DEFAULT_PROFILE);
    expect(sent.tripRecords).toHaveLength(1);
    expect(sent.tripRecords[0]).not.toHaveProperty('userId');
  });

  it('garde la marque si le reseau tombe pendant l envoi', async () => {
    openSession();
    markDirty(USER.id);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    expect(await pushState(USER.id)).toBe('pending');
    // Rien n'est perdu : l'etat attend le retour du reseau.
    expect(hasPending(USER.id)).toBe(true);
  });

  it('garde la marque quand la session a expire', async () => {
    openSession();
    markDirty(USER.id);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'Session expiree.' }, 401));

    expect(await pushState(USER.id)).toBe('pending');
    expect(hasPending(USER.id)).toBe(true);
  });

  it('abandonne un etat refuse par la validation serveur plutot que de le renvoyer sans fin', async () => {
    openSession();
    markDirty(USER.id);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'Requete invalide.' }, 422));

    expect(await pushState(USER.id)).toBe('clean');
    expect(hasPending(USER.id)).toBe(false);
  });

  it('conserve une ecriture faite pendant la requete', async () => {
    openSession();
    markDirty(USER.id);
    const duringRequest = async (): Promise<Response> => {
      markDirty(USER.id); // l'utilisateur agit pendant l'aller-retour
      return jsonResponse({});
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(duringRequest as unknown as typeof fetch);

    expect(await pushState(USER.id)).toBe('pending');
    expect(hasPending(USER.id)).toBe(true);
  });

  it("n'envoie jamais l'etat d'un autre compte", async () => {
    openSession();
    markDirty('user-2');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(await pushState(USER.id)).toBe('clean');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(hasPending('user-2')).toBe(true);
  });
});

describe('adoptRemoteSession', () => {
  it('hydrate le cache local depuis le serveur', () => {
    adoptRemoteSession(USER, { profile: USER.profile, tripRecords: [RECORD], plannedTrips: [], recurringTrips: [], savedRoutes: [] });

    expect(loadTripHistory(USER.id)).toHaveLength(1);
  });

  it("n'ecrase pas un etat local encore a envoyer", () => {
    openSession();
    saveTripRecord(RECORD);

    adoptRemoteSession(USER, { profile: USER.profile, tripRecords: [], plannedTrips: [], recurringTrips: [], savedRoutes: [] });

    // L'etat local est en avance sur le serveur : c'est lui qui partira.
    expect(loadTripHistory(USER.id)).toHaveLength(1);
    expect(hasPending(USER.id)).toBe(true);
  });
});

describe('discardPending', () => {
  it('efface la marque du compte supprime, pas celle d un autre', () => {
    markDirty(USER.id);
    discardPending(USER.id);
    expect(hasPending(USER.id)).toBe(false);

    markDirty('user-2');
    discardPending(USER.id);
    expect(hasPending('user-2')).toBe(true);
  });
});
