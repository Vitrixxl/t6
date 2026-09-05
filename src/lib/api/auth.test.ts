import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { DEFAULT_PROFILE, type SessionUser } from '../../contracts';
import { deleteAccount, loginUser, logoutUser } from './auth';

const USER: SessionUser = { id: 'user-1', email: 'a@b.fr', displayName: 'Test', profile: DEFAULT_PROFILE };

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
    mock.restore();
});

describe('session', () => {
    it('la connexion rend le compte et son état tels que le serveur les envoie', async () => {
        const state = { profile: DEFAULT_PROFILE, tripRecords: [], plannedTrips: [], recurringTrips: [], savedRoutes: [] };
        const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ user: USER, state }));

        const session = await loginUser({ email: ' a@b.fr ', password: 'UrbanFlow2026!' });

        expect(session.user.id).toBe('user-1');
        expect(session.state.plannedTrips).toEqual([]);
        const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/api/auth/login');
        expect(JSON.parse(String(init.body))).toMatchObject({ email: 'a@b.fr' });
    });

    it('une connexion refusée remonte le message du serveur', async () => {
        spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'Identifiants invalides.' }, 401));

        await expect(loginUser({ email: 'a@b.fr', password: 'faux' })).rejects.toThrow('Identifiants invalides.');
    });

    it('la déconnexion révoque la session côté serveur', async () => {
        const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));

        await logoutUser();

        expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/api/auth/logout');
    });

    it("l'effacement du compte passe par le serveur, qui supprime en cascade (RGPD art. 17)", async () => {
        const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true }));

        await deleteAccount();

        const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/api/me');
        expect(init.method).toBe('DELETE');
    });
});
