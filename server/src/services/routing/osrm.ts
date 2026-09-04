// Protocole OSRM : profils, appel, lecture de la reponse.
//
// OSRM prepare un jeu de donnees par profil : marche et velo ont des regles
// differentes sur les memes rues (sens uniques, escaliers, zones pietonnes),
// et ne peuvent donc pas partager un index. La trottinette reprend le profil
// velo ; toutes les URLs restent derivees d'une meme racine configurable.
import { z } from 'zod';
import type { GeoPoint, RouteInstruction, RoutableMode } from '../../../../src/types.ts';
import { buildInstructions } from './instructions.ts';

const UPSTREAM_TIMEOUT_MS = 8_000;
const PUBLIC_OSRM_HOST = 'routing.openstreetmap.de';
const PUBLIC_OSRM_INTERVAL_MS = 1_100;
let publicRequestQueue: Promise<void> = Promise.resolve();
let nextPublicRequestAt = 0;

/**
 * L'instance publique refuse les rafales (HTTP 429). Les appels de plusieurs
 * options partagent donc une cadence au niveau du serveur. Une instance locale
 * n'est pas ralentie ; son interet est precisement d'absorber la charge.
 */
async function waitForPublicSlot(baseUrl: string): Promise<void> {
    if (new URL(baseUrl).hostname !== PUBLIC_OSRM_HOST) {
        return;
    }

    const turn = publicRequestQueue.then(async () => {
        const delay = Math.max(nextPublicRequestAt - Date.now(), 0);
        if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
        nextPublicRequestAt = Date.now() + PUBLIC_OSRM_INTERVAL_MS;
    });
    publicRequestQueue = turn.catch(() => undefined);
    await turn;
}

async function requestOsrm(baseUrl: string, url: string): Promise<Response> {
    await waitForPublicSlot(baseUrl);
    return fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
}

const osrmStep = z.object({
    distance: z.number(),
    duration: z.number(),
    name: z.string(),
    maneuver: z.object({
        type: z.string(),
        modifier: z.string().optional(),
        exit: z.number().optional(),
    }),
});
export type OsrmStep = z.infer<typeof osrmStep>;

const osrmResponse = z.object({
    code: z.string(),
    routes: z.array(z.object({
        distance: z.number(),
        duration: z.number(),
        geometry: z.object({
            type: z.literal('LineString'),
            coordinates: z.array(z.tuple([z.number(), z.number()])),
        }),
        legs: z.array(z.object({ steps: z.array(osrmStep).optional() })).optional(),
    })),
});

const osrmTableResponse = z.object({
    code: z.string(),
    distances: z.array(z.array(z.number().nullable())),
    durations: z.array(z.array(z.number().nullable())),
});

export interface RouteGeometry {
    path: [number, number][];
    distanceMeters: number;
    durationSeconds: number;
    instructions: RouteInstruction[];
}

export interface RouteMeasure {
    distanceMeters: number;
    durationSeconds: number;
}

/**
 * Chemin du service pour un mode. Les noms suivent la convention des instances
 * OSRM (`/routed-<profil>/route/v1/<profil>/`), celle qu'utilisent aussi bien
 * l'instance publique que les images officielles auto-hebergees.
 */
function profile(mode: RoutableMode): 'foot' | 'bike' | 'driving' {
    if (mode === 'walk') {
        return 'foot';
    }
    if (mode === 'car') {
        return 'driving';
    }
    return 'bike';
}

/** Chemin uniforme de l'instance publique et de la facade auto-hebergee. */
export function servicePath(mode: RoutableMode, service: 'route' | 'table'): string {
    const name = profile(mode);
    const serviceProfile = mode === 'car' ? 'car' : name;
    return `/routed-${serviceProfile}/${service}/v1/${name}/`;
}

export async function fetchUpstreamRoute(
    baseUrl: string,
    mode: RoutableMode,
    from: Pick<GeoPoint, 'lat' | 'lon'>,
    to: Pick<GeoPoint, 'lat' | 'lon'>,
): Promise<RouteGeometry | null> {
    const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const url = `${baseUrl}${servicePath(mode, 'route')}${coordinates}?overview=full&geometries=geojson&steps=true`;

    try {
        const response = await requestOsrm(baseUrl, url);
        if (!response.ok) {
            return null;
        }

        const parsed = osrmResponse.safeParse(await response.json());
        if (!parsed.success) {
            return null;
        }
        const payload = parsed.data;
        const route = payload.routes?.[0];
        if (payload.code !== 'Ok' || !route || route.geometry.coordinates.length < 2) {
            return null;
        }

        return {
            path: route.geometry.coordinates,
            distanceMeters: route.distance,
            durationSeconds: route.duration,
            instructions: buildInstructions(route.legs?.flatMap((leg) => leg.steps ?? []) ?? []),
        };
    } catch {
        // Indisponibilite, delai depasse, reponse illisible : l'appelant tranchera
        // ce qu'il en dit a l'utilisateur. On ne fabrique pas de trace de repli.
        return null;
    }
}

/**
 * Distances et durees de toutes les origines vers toutes les destinations.
 * Une seule requete remplace jusqu'a huit appels individuels lors du choix
 * d'une station. Les valeurs `null` d'OSRM signalent un couple inaccessible.
 */
export async function fetchUpstreamMatrix(
    baseUrl: string,
    mode: RoutableMode,
    origins: Array<Pick<GeoPoint, 'lat' | 'lon'>>,
    destinations: Array<Pick<GeoPoint, 'lat' | 'lon'>>,
): Promise<Array<Array<RouteMeasure | null>> | null> {
    const points = [...origins, ...destinations];
    const coordinates = points.map((point) => `${point.lon},${point.lat}`).join(';');
    const sources = origins.map((_, index) => index).join(';');
    const destinationsIndexes = destinations.map((_, index) => origins.length + index).join(';');
    const query = new URLSearchParams({ sources, destinations: destinationsIndexes, annotations: 'distance,duration' });
    const url = `${baseUrl}${servicePath(mode, 'table')}${coordinates}?${query.toString()}`;

    try {
        const response = await requestOsrm(baseUrl, url);
        if (!response.ok) {
            return null;
        }

        const parsed = osrmTableResponse.safeParse(await response.json());
        if (!parsed.success) {
            return null;
        }
        const payload = parsed.data;
        if (
            payload.code !== 'Ok' ||
            payload.distances.length !== origins.length ||
            payload.durations.length !== origins.length
        ) {
            return null;
        }

        return origins.map((_, originIndex) =>
            destinations.map((__, destinationIndex) => {
                const distanceMeters = payload.distances[originIndex]?.[destinationIndex];
                const durationSeconds = payload.durations[originIndex]?.[destinationIndex];
                if (
                    distanceMeters === null ||
                    durationSeconds === null ||
                    distanceMeters === undefined ||
                    durationSeconds === undefined ||
                    !Number.isFinite(distanceMeters) ||
                    !Number.isFinite(durationSeconds) ||
                    distanceMeters < 0 ||
                    durationSeconds < 0
                ) {
                    return null;
                }
                return { distanceMeters, durationSeconds };
            }),
        );
    } catch {
        return null;
    }
}
