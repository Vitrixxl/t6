// Outillage commun aux tests d'integration.
//
// Les routes sont appelees en memoire (app.handle) sur une base SQLite
// ephemere : pas de port, pas de reseau, pas de fichier a nettoyer. La suite
// reste rejouable en CI et sur n'importe quel poste.
import { createApp } from '../app.ts';
import type { ServerConfig } from '../config/index.ts';
import { resetRateLimits } from '../plugins/rate-limit.ts';

const BASE = 'http://localhost';

export const PASSWORD = 'UrbanFlow2026!';

export interface TestApi {
    call: (path: string, options?: CallOptions) => Promise<Response>;
    register: (email?: string) => Promise<string>;
    /** Ecrit une seule ressource, dont l'identifiant figure deja dans l'URL. */
    putResource: (cookie: string, path: string, body: unknown) => Promise<Response>;
    /** Remplace le profil de mobilite. */
    putProfile: (cookie: string, profile: Record<string, unknown>) => Promise<Response>;
    /** Acces direct a la base, pour verifier ce que l'API a reellement ecrit. */
    db: ReturnType<typeof createApp>['decorator']['db'];
    close: () => void;
}

export interface CallOptions {
    method?: string;
    body?: unknown;
    cookie?: string;
}

export function createTestApi(overrides: Partial<ServerConfig> = {}): TestApi {
    const app = createApp({
        databasePath: ':memory:',
        // Le faux calculateur des tests ne doit pas subir la temporisation reservee
        // au service public, meme si fetch est remplace juste apres par le test.
        osrmBaseUrl: 'https://osrm.test',
        ...overrides,
    });
    // Les compteurs de debit sont partages par le processus : on repart de zero
    // pour que l'ordre des tests n'ait aucune influence.
    resetRateLimits();

    const call = (path: string, options: CallOptions = {}): Promise<Response> => {
        const headers: Record<string, string> = {};
        if (options.body !== undefined) {
            headers['content-type'] = 'application/json';
        }
        if (options.cookie) {
            headers.cookie = options.cookie;
        }

        return app.handle(
            new Request(`${BASE}${path}`, {
                method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
                headers,
                body: options.body === undefined ? undefined : JSON.stringify(options.body),
            }),
        );
    };

    return {
        call,
        async register(email = 'citoyen@lyon.fr') {
            const response = await call('/api/auth/register', {
                body: { email, password: PASSWORD, displayName: 'Citoyen' },
            });
            if (response.status !== 201) {
                throw new Error(`inscription impossible (${response.status}) : ${await response.text()}`);
            }
            return sessionCookie(response);
        },
        putResource(cookie, path, body) {
            return call(path, { method: 'PUT', cookie, body });
        },
        putProfile(cookie, profile) {
            return call('/api/me/profile', { method: 'PUT', cookie, body: profile });
        },
        db: app.decorator.db,
        close() {
            // L'application n'ecoute jamais sur un port dans les tests : on ferme
            // directement la base ephemere plutot qu'un serveur inexistant.
            app.decorator.db.$client.close();
        },
    };
}

// Formes de reponse attendues. Les declarer sert deux fois : le test est type
// sans cast disperse, et il echoue a la compilation si le contrat de l'API
// change sans que le test suive.
export interface ErrorBody {
    error: string;
}

export interface StateBody {
    profile: { maxWalkMinutes: number; displayName: string };
    tripRecords: { id: string }[];
    plannedTrips: { id: string; status: string }[];
    recurringTrips: { id: string }[];
    savedRoutes: { id: string }[];
}

export interface AuthBody {
    user: { id: string; email: string; displayName: string; profile: StateBody['profile'] };
    state: StateBody;
}

export interface ExportBody extends StateBody {
    exportedAt: string;
    account: { id: string; email: string; displayName: string; createdAt: string };
}

export interface OpenApiSpec {
    openapi: string;
    paths: Record<string, unknown>;
}

/** Lit le corps JSON d'une reponse dans la forme attendue par le test. */
export function json<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
}

/** Extrait le cookie de session d'une reponse, pour le rejouer ensuite. */
export function sessionCookie(response: Response): string {
    return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

export const TRIP_RECORD = {
    id: 'trip-1',
    routeTitle: 'Velo + metro',
    modes: ['bike', 'transit'],
    distanceKm: 5.2,
    durationMinutes: 22,
    carbonGrams: 136,
    carbonSavedGrams: 900,
    createdAt: '2026-09-01T08:00:00.000Z',
};

export const TRIP_SHAPE = {
    origin: { lat: 45.76, lon: 4.85, label: 'Part-Dieu' },
    destination: { lat: 45.75, lon: 4.83, label: 'Bellecour' },
    modes: ['transit'],
    distanceKm: 3,
    durationMinutes: 12,
    carbonGrams: 90,
    carbonSavedGrams: 400,
    createdAt: '2026-09-01T08:00:00.000Z',
};

export const PLANNED_TRIP = {
    ...TRIP_SHAPE,
    label: 'Domicile - travail',
    scheduledFor: '2026-09-02T06:15:00.000Z',
    status: 'planned',
    completedAt: null,
};
