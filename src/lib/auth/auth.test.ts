import { afterEach, describe, expect, it, vi } from '../../test/harness';
import { DEFAULT_PROFILE, deleteAccount, getCurrentSession, logoutUser, saveMobilityProfile } from './index';
import { cacheSessionUser, setActiveSessionId } from '../api/session';
import type { SessionUser } from '../../types';

const USER: SessionUser = { id: 'user-1', email: 'a@b.fr', displayName: 'Test', profile: DEFAULT_PROFILE };

/** Simule un compte deja authentifie par le serveur et copie localement. */
function openSession(user: SessionUser = USER): void {
  cacheSessionUser(user);
  setActiveSessionId(user.id);
}

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getCurrentSession', () => {
  it('rend null sans session', () => {
    expect(getCurrentSession()).toBeNull();
  });

  it('rend la copie locale du compte de l onglet', () => {
    openSession();
    expect(getCurrentSession()?.email).toBe('a@b.fr');
  });

  it('ignore une copie qui n appartient pas a la session courante', () => {
    cacheSessionUser(USER);
    setActiveSessionId('autre');
    expect(getCurrentSession()).toBeNull();
  });
});

describe('saveMobilityProfile', () => {
  it('borne la marche maximale (5-45 min) et l\'objectif carbone (250-20000 g)', () => {
    openSession();

    const updated = saveMobilityProfile(USER.id, { ...USER.profile, maxWalkMinutes: 999, carbonGoalGramsPerWeek: 10 });

    expect(updated.profile.maxWalkMinutes).toBe(45);
    expect(updated.profile.carbonGoalGramsPerWeek).toBe(250);
    // La copie locale suit : un rechargement rend le profil corrige.
    expect(getCurrentSession()?.profile.maxWalkMinutes).toBe(45);
  });

  it('deduplique les modes et retombe sur les modes par defaut si la liste est vide', () => {
    openSession();

    const deduped = saveMobilityProfile(USER.id, { ...USER.profile, preferredModes: ['bike', 'bike', 'walk'] });
    expect(deduped.profile.preferredModes).toEqual(['bike', 'walk']);

    const emptied = saveMobilityProfile(USER.id, { ...USER.profile, preferredModes: [] });
    expect(emptied.profile.preferredModes).toEqual(DEFAULT_PROFILE.preferredModes);
  });

  it('neutralise les chevrons du nom affiche (anti-injection)', () => {
    openSession();

    const updated = saveMobilityProfile(USER.id, { ...USER.profile, displayName: '<script>Nadia</script>' });

    expect(updated.displayName).not.toMatch(/[<>]/);
    expect(updated.displayName).toContain('Nadia');
  });

  it('refuse d ecrire sans session', () => {
    expect(() => saveMobilityProfile(USER.id, USER.profile)).toThrow(/session/i);
  });
});

describe('logoutUser', () => {
  it('ferme la session locale et revoque cote serveur', () => {
    openSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());

    logoutUser();

    expect(getCurrentSession()).toBeNull();
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/auth/logout');
  });
});

describe('deleteAccount', () => {
  it('supprime session et TOUTES les donnees locales de l\'utilisateur (droit a l\'effacement RGPD)', () => {
    openSession();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    localStorage.setItem(`ufm.tripHistory.${USER.id}`, '[]');
    localStorage.setItem(`ufm.savedRoutes.${USER.id}`, '[]');
    localStorage.setItem(`urbanflow:search-history:${USER.id}`, '[]');

    deleteAccount(USER.id);

    expect(getCurrentSession()).toBeNull();
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/me');
    // Aucune cle residuelle ne doit porter l'identifiant de l'utilisateur.
    const remainingKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    expect(remainingKeys.filter((key) => key?.includes(USER.id))).toEqual([]);
  });

  it('preserve les donnees des autres utilisateurs lors d\'un effacement', () => {
    openSession();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse());
    localStorage.setItem(`ufm.savedRoutes.${USER.id}`, '[]');
    localStorage.setItem('ufm.savedRoutes.user-2', '["garde"]');

    deleteAccount(USER.id);

    expect(localStorage.getItem(`ufm.savedRoutes.${USER.id}`)).toBeNull();
    expect(localStorage.getItem('ufm.savedRoutes.user-2')).toBe('["garde"]');
  });
});
