// Inscription, connexion, session : le chemin critique de sécurité.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { TERMS_VERSION } from '../../../src/contracts/index.ts';
import { users } from '../db/schema.ts';
import { PASSWORD, createTestApi, json, type AuthBody, type ErrorBody, type TestApi } from './helpers.ts';

let api: TestApi;

beforeEach(() => {
    api = createTestApi();
});

afterEach(() => {
    api.close();
});

describe('inscription', () => {
    it('crée un compte et ouvre une session par cookie httpOnly', async () => {
        const response = await api.call('/api/auth/register', {
            body: { email: 'citoyen@lyon.fr', password: PASSWORD, displayName: 'Citoyen', termsAccepted: true },
        });

        expect(response.status).toBe(201);
        expect((await json<AuthBody>(response)).user.email).toBe('citoyen@lyon.fr');

        const cookie = (response.headers.get('set-cookie') ?? '').toLowerCase();
        expect(cookie).toContain('ufm_session=');
        expect(cookie).toContain('httponly');
        expect(cookie).toContain('samesite=lax');
    });

    it('hache le mot de passe en argon2id et ne le renvoie jamais', async () => {
        const response = await api.call('/api/auth/register', {
            body: { email: 'a@lyon.fr', password: PASSWORD, displayName: 'A', termsAccepted: true },
        });
        const body = await response.text();

        expect(body).not.toContain(PASSWORD);
        expect(body).not.toContain('argon2');
        // Vérification directe en base : l'empreinte porte bien ses paramètres.
        const stored = api.db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.email, 'a@lyon.fr')).get();
        expect(stored?.passwordHash).toStartWith('$argon2id$');
    });

    it('refuse un mot de passe trop court ou sans chiffre', async () => {
        for (const password of ['court1', 'sansaucunchiffreici']) {
            const response = await api.call('/api/auth/register', {
                body: { email: 'b@lyon.fr', password, displayName: 'B', termsAccepted: true },
            });
            expect(response.status).toBe(422);
        }
    });

    it('refuse un email mal forme', async () => {
        const response = await api.call('/api/auth/register', {
            body: { email: 'pas-un-email', password: PASSWORD, displayName: 'B', termsAccepted: true },
        });
        expect(response.status).toBe(422);
    });

    it('refuse un email déjà enregistré', async () => {
        await api.register('doublon@lyon.fr');
        const response = await api.call('/api/auth/register', {
            body: { email: 'doublon@lyon.fr', password: PASSWORD, displayName: 'Doublon', termsAccepted: true },
        });
        expect(response.status).toBe(409);
    });

    it('refuse une inscription sans acceptation des conditions', async () => {
        for (const termsAccepted of [false, undefined]) {
            const response = await api.call('/api/auth/register', {
                body: { email: 'sans@lyon.fr', password: PASSWORD, displayName: 'Sans', termsAccepted },
            });
            expect(response.status).toBe(422);
        }
        expect(api.db.select({ id: users.id }).from(users).all()).toHaveLength(0);
    });

    it('conserve la date et la version des conditions acceptées', async () => {
        await api.register('accepte@lyon.fr');
        const stored = api.db
            .select({ termsAcceptedAt: users.termsAcceptedAt, termsVersion: users.termsVersion })
            .from(users)
            .where(eq(users.email, 'accepte@lyon.fr'))
            .get();
        expect(stored?.termsVersion).toBe(TERMS_VERSION);
        expect(Date.parse(stored?.termsAcceptedAt ?? '')).not.toBeNaN();
    });
});

describe('connexion', () => {
    it('renvoie le même message pour un compte inconnu et un mot de passe faux', async () => {
        await api.register('connu@lyon.fr');

        const inconnu = await api.call('/api/auth/login', { body: { email: 'inconnu@lyon.fr', password: PASSWORD } });
        const mauvais = await api.call('/api/auth/login', {
            body: { email: 'connu@lyon.fr', password: 'MauvaisMotDePasse1' },
        });

        expect(inconnu.status).toBe(401);
        expect(mauvais.status).toBe(401);
        // Aucun oracle d'énumération : les deux réponses sont indiscernables.
        expect((await json<ErrorBody>(inconnu)).error).toBe((await json<ErrorBody>(mauvais)).error);
    });

    it('accepte la reconnexion avec le bon mot de passe', async () => {
        await api.register('retour@lyon.fr');
        const response = await api.call('/api/auth/login', { body: { email: 'retour@lyon.fr', password: PASSWORD } });

        expect(response.status).toBe(200);
        expect((await json<AuthBody>(response)).user.email).toBe('retour@lyon.fr');
    });

    it('bloque le bourrage d’identifiants au-delà de la limite', async () => {
        let last: Response | undefined;
        for (let attempt = 0; attempt < 12; attempt += 1) {
            last = await api.call('/api/auth/login', { body: { email: 'x@lyon.fr', password: PASSWORD } });
        }

        expect(last?.status).toBe(429);
        expect(last?.headers.get('retry-after')).toBeTruthy();
    });
});

describe('session', () => {
    it('révoque la session côté serveur a la déconnexion', async () => {
        const cookie = await api.register('deco@lyon.fr');
        expect((await api.call('/api/trips/planned', { cookie })).status).toBe(200);

        await api.call('/api/auth/logout', { method: 'POST', cookie });

        // Le jeton vole après coup ne vaut plus rien : la révocation est en base,
        // pas seulement dans le navigateur.
        expect((await api.call('/api/trips/planned', { cookie })).status).toBe(401);
    });

    it('reprend la session portée par le cookie', async () => {
        const cookie = await api.register('reprise@lyon.fr');
        const response = await api.call('/api/auth/session', { cookie });

        expect(response.status).toBe(200);
        expect((await json<AuthBody>(response)).user.email).toBe('reprise@lyon.fr');
    });

    it('refuse toute route protégée sans session', async () => {
        for (const path of ['/api/trips/planned', '/api/me/export', '/api/auth/session']) {
            expect((await api.call(path)).status).toBe(401);
        }
    });

    it('refuse un jeton de session invente', async () => {
        expect((await api.call('/api/trips/planned', { cookie: 'ufm_session=jeton-invente' })).status).toBe(401);
    });
});
