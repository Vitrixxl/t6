import { afterEach, describe, expect, it, vi } from '../../test/harness';
import { DEFAULT_PROFILE, deleteAccount, loginUser, logoutUser, sanitizeProfile } from './index';
import type { SessionUser } from '../../types';

const USER: SessionUser = { id: 'user-1', email: 'a@b.fr', displayName: 'Test', profile: DEFAULT_PROFILE };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('sanitizeProfile', () => {
  it('borne la marche maximale (5-45 min) et l\'objectif carbone (250-20000 g)', () => {
    const profile = sanitizeProfile({ ...DEFAULT_PROFILE, maxWalkMinutes: 999, carbonGoalGramsPerWeek: 10 });

    expect(profile.maxWalkMinutes).toBe(45);
    expect(profile.carbonGoalGramsPerWeek).toBe(250);
  });

  it('deduplique les modes et retombe sur les modes par defaut si la liste est vide', () => {
    expect(sanitizeProfile({ ...DEFAULT_PROFILE, preferredModes: ['bike', 'bike', 'walk'] }).preferredModes).toEqual(['bike', 'walk']);
    expect(sanitizeProfile({ ...DEFAULT_PROFILE, preferredModes: [] }).preferredModes).toEqual(DEFAULT_PROFILE.preferredModes);
  });

  it('neutralise les chevrons du nom affiche (anti-injection)', () => {
    const profile = sanitizeProfile({ ...DEFAULT_PROFILE, displayName: '<script>Nadia</script>' });

    expect(profile.displayName).not.toMatch(/[<>]/);
    expect(profile.displayName).toContain('Nadia');
  });
});

describe('session', () => {
  it('la connexion rend le compte et son etat tels que le serveur les envoie', async () => {
    const state = { profile: DEFAULT_PROFILE, tripRecords: [], plannedTrips: [], recurringTrips: [], savedRoutes: [] };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ user: USER, state }));

    const session = await loginUser({ email: ' a@b.fr ', password: 'UrbanFlow2026!' });

    expect(session.user.id).toBe('user-1');
    expect(session.state.plannedTrips).toEqual([]);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/auth/login');
    expect(JSON.parse(String(init.body))).toMatchObject({ email: 'a@b.fr' });
  });

  it('une connexion refusee remonte le message du serveur', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'Identifiants invalides.' }, 401));

    await expect(loginUser({ email: 'a@b.fr', password: 'faux' })).rejects.toThrow('Identifiants invalides.');
  });

  it('la deconnexion revoque la session cote serveur', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));

    logoutUser();

    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/auth/logout');
  });

  it("l'effacement du compte passe par le serveur, qui supprime en cascade (RGPD art. 17)", async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));

    await deleteAccount();

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/me');
    expect(init.method).toBe('DELETE');
  });
});
