// Outillage commun aux tests d'intégration.
//
// Les routes sont appelées en mémoire (app.handle) sur une base SQLite
// ephemere : pas de port, pas de réseau, pas de fichier a nettoyer. La suite
// reste rejouable en CI et sur n'importe quel poste.
import { createApp } from '../app.ts';
import type { ServerConfig } from '../config/index.ts';
import { resetRateLimits } from '../plugins/rate-limit.ts';

const BASE = 'http://localhost';

export const PASSWORD = 'UrbanFlow2026!';

export interface TestApi {
    call: (path: string, options?: CallOptions) => Promise<Response>;
    register: (email?: string) => Promise<string>;
    /** Ecrit une seule ressource, dont l'identifiant figure déjà dans l'URL. */
    putResource: (cookie: string, path: string, body: unknown) => Promise<Response>;
    /** Remplace le profil de mobilité. */
    putProfile: (cookie: string, profile: Record<string, unknown>) => Promise<Response>;
    /** Accès direct à la base, pour verifier ce que l'API a réellement ecrit. */
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
        // au service public, même si fetch est remplacé juste après par le test.
        osrmUrls: {
            foot: 'http://osrm-foot:5000',
            bike: 'http://osrm-bike:5000',
            car: 'http://osrm-car:5000',
        },
        ...overrides,
    });
    // Les compteurs de débit sont partagés par le processus : on repart de zéro
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
                body: { email, password: PASSWORD, displayName: 'Citoyen', termsAccepted: true },
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
            // L'application n'écoute jamais sur un port dans les tests : on ferme
            // directement la base ephemere plutôt qu'un serveur inexistant.
            app.decorator.db.$client.close();
        },
    };
}

// Formes de réponse attendues. Les declarer sert deux fois : le test est type
// sans cast disperse, et il echoue à la compilation si le contrat de l'API
// change sans que le test suive.
export interface ErrorBody {
    error: string;
}

export interface StateBody {
    profile: { displayName: string };
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
    account: { id: string; email: string; displayName: string; createdAt: string; termsAcceptedAt: string | null; termsVersion: string | null };
}

export interface OpenApiSpec {
    openapi: string;
    paths: Record<string, unknown>;
}

/** Lit le corps JSON d'une réponse dans la forme attendue par le test. */
export function json<T>(response: Response): Promise<T> {
    return response.json() as Promise<T>;
}

/** Extrait le cookie de session d'une réponse, pour le rejouer ensuite. */
export function sessionCookie(response: Response): string {
    return (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

export const TRIP_RECORD = {
    id: 'trip-1',
    routeTitle: 'Vélo + métro',
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
