import { describe, expect, it } from '../../test/harness';
import {
  DEFAULT_PROFILE,
  deleteLocalAccount,
  getCurrentSession,
  loginUser,
  logoutUser,
  registerUser,
  saveMobilityProfile,
} from './index';
import type { StoredUser } from '../../types';

const VALID_PASSWORD = 'UrbanFlow2026!';

function storedUsers(): StoredUser[] {
  return JSON.parse(localStorage.getItem('ufm.users') ?? '[]') as StoredUser[];
}

describe('registerUser', () => {
  it('rejette un email invalide', async () => {
    await expect(
      registerUser({ email: 'pas-un-email', password: VALID_PASSWORD, displayName: 'Test' }),
    ).rejects.toThrow(/email invalide/i);
  });

  it('rejette un mot de passe trop court ou sans chiffre', async () => {
    await expect(
      registerUser({ email: 'a@b.fr', password: 'court1', displayName: 'Test' }),
    ).rejects.toThrow(/12 caracteres/i);
    await expect(
      registerUser({ email: 'a@b.fr', password: 'sansaucunchiffreici', displayName: 'Test' }),
    ).rejects.toThrow(/12 caracteres/i);
  });

  it('refuse un email deja enregistre', async () => {
    await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Un' });
    await expect(
      registerUser({ email: 'A@B.FR ', password: VALID_PASSWORD, displayName: 'Deux' }),
    ).rejects.toThrow(/existe deja/i);
  });

  it('ne stocke jamais le mot de passe en clair (PBKDF2 + sel)', async () => {
    await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Test' });
    const payload = localStorage.getItem('ufm.users') ?? '';
    const user = storedUsers().find((item) => item.email === 'a@b.fr');

    expect(payload).not.toContain(VALID_PASSWORD);
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordSalt).toBeTruthy();
    expect(user?.passwordHash).not.toBe(VALID_PASSWORD);
  });

  it('produit des empreintes distinctes pour un meme mot de passe (sel aleatoire)', async () => {
    await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Un' });
    await registerUser({ email: 'c@d.fr', password: VALID_PASSWORD, displayName: 'Deux' });
    const [first, second] = ['a@b.fr', 'c@d.fr'].map(
      (email) => storedUsers().find((item) => item.email === email)?.passwordHash,
    );

    expect(first).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it('neutralise les chevrons du nom affiche (anti-injection)', async () => {
    const session = await registerUser({
      email: 'a@b.fr',
      password: VALID_PASSWORD,
      displayName: '<script>Nadia</script>',
    });

    expect(session.displayName).not.toMatch(/[<>]/);
    expect(session.displayName).toContain('Nadia');
  });
});

describe('loginUser', () => {
  it('accepte les identifiants valides et ouvre une session', async () => {
    await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Test' });
    logoutUser();

    const session = await loginUser({ email: 'a@b.fr', password: VALID_PASSWORD });
    expect(session.email).toBe('a@b.fr');
    expect(getCurrentSession()?.email).toBe('a@b.fr');
  });

  it('repond par un message generique, identique pour mauvais mot de passe et compte inconnu', async () => {
    await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Test' });

    await expect(loginUser({ email: 'a@b.fr', password: 'MauvaisPass123' })).rejects.toThrow(
      'Identifiants invalides.',
    );
    await expect(loginUser({ email: 'inconnu@b.fr', password: VALID_PASSWORD })).rejects.toThrow(
      'Identifiants invalides.',
    );
  });

  it('logoutUser ferme la session sans supprimer le compte', async () => {
    await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Test' });
    logoutUser();

    expect(getCurrentSession()).toBeNull();
    expect(storedUsers().some((user) => user.email === 'a@b.fr')).toBe(true);
  });
});

describe('saveMobilityProfile', () => {
  it('borne la marche maximale (5-45 min) et l\'objectif carbone (250-20000 g)', async () => {
    const session = await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Test' });

    const updated = saveMobilityProfile(session.id, {
      ...session.profile,
      maxWalkMinutes: 999,
      carbonGoalGramsPerWeek: 10,
    });

    expect(updated.profile.maxWalkMinutes).toBe(45);
    expect(updated.profile.carbonGoalGramsPerWeek).toBe(250);
  });

  it('deduplique les modes et retombe sur les modes par defaut si la liste est vide', async () => {
    const session = await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Test' });

    const deduped = saveMobilityProfile(session.id, {
      ...session.profile,
      preferredModes: ['bike', 'bike', 'walk'],
    });
    expect(deduped.profile.preferredModes).toEqual(['bike', 'walk']);

    const emptied = saveMobilityProfile(session.id, { ...session.profile, preferredModes: [] });
    expect(emptied.profile.preferredModes).toEqual(DEFAULT_PROFILE.preferredModes);
  });
});

describe('deleteLocalAccount', () => {
  it('supprime compte, session et TOUTES les donnees locales de l\'utilisateur (droit a l\'effacement RGPD)', async () => {
    const session = await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Test' });
    localStorage.setItem(`ufm.tripHistory.${session.id}`, '[]');
    localStorage.setItem(`ufm.savedRoutes.${session.id}`, '[]');
    localStorage.setItem(`urbanflow:search-history:${session.id}`, '[]');

    deleteLocalAccount(session.id);

    expect(storedUsers().some((user) => user.id === session.id)).toBe(false);
    expect(getCurrentSession()).toBeNull();
    // Aucune cle residuelle ne doit porter l'identifiant de l'utilisateur.
    const remainingKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    expect(remainingKeys.filter((key) => key?.includes(session.id))).toEqual([]);
  });

  it('preserve les donnees des autres utilisateurs lors d\'un effacement', async () => {
    const first = await registerUser({ email: 'a@b.fr', password: VALID_PASSWORD, displayName: 'Un' });
    const second = await registerUser({ email: 'c@d.fr', password: VALID_PASSWORD, displayName: 'Deux' });
    localStorage.setItem(`ufm.savedRoutes.${first.id}`, '[]');
    localStorage.setItem(`ufm.savedRoutes.${second.id}`, '["garde"]');

    deleteLocalAccount(first.id);

    expect(localStorage.getItem(`ufm.savedRoutes.${first.id}`)).toBeNull();
    expect(localStorage.getItem(`ufm.savedRoutes.${second.id}`)).toBe('["garde"]');
    expect(storedUsers().some((user) => user.id === second.id)).toBe(true);
  });
});
