// Protocole OSRM : profils, appel, lecture de la réponse.
//
// OSRM prépare un jeu de données par profil : marche et vélo ont des règles
// différentes sur les mêmes rues (sens uniques, escaliers, zones piétonnes),
// et ne peuvent donc pas partager un index. La trottinette reprend le profil
// vélo ; chaque moteur possède sa propre adresse configurable.
import { z } from 'zod';
import type { ServerConfig } from '../../config/index.ts';
import type { GeoPoint, RouteInstruction, RouteMeasure, RoutableMode } from '../../../../src/types.ts';
import { buildInstructions } from './instructions.ts';

const UPSTREAM_TIMEOUT_MS = 8_000;
async function requestOsrm(url: string, signal?: AbortSignal): Promise<Response> {
    return fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.any([AbortSignal.timeout(UPSTREAM_TIMEOUT_MS), ...(signal ? [signal] : [])]),
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

function routeMeasure(distanceMeters: number | null | undefined, durationSeconds: number | null | undefined): RouteMeasure | null {
    const valid = distanceMeters !== null
        && durationSeconds !== null
        && distanceMeters !== undefined
        && durationSeconds !== undefined
        && Number.isFinite(distanceMeters)
        && Number.isFinite(durationSeconds)
        && distanceMeters >= 0
        && durationSeconds >= 0;
    return valid ? { distanceMeters, durationSeconds } : null;
}

/**
 * Le profil de la voiture se nomme driving dans le protocole OSRM.
 * La trottinette utilise les mêmes règles de circulation que le vélo.
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

/** Chaque adresse désigne un moteur local. */
function serviceUrl(urls: ServerConfig['osrmUrls'], mode: RoutableMode, service: 'route' | 'table'): string {
    const name = profile(mode);
    const baseUrl = mode === 'car' ? urls.car : name === 'foot' ? urls.foot : urls.bike;
    return `${baseUrl}/${service}/v1/${name}/`;
}

export async function fetchOsrmRoute(
    urls: ServerConfig['osrmUrls'],
    mode: RoutableMode,
    from: Pick<GeoPoint, 'lat' | 'lon'>,
    to: Pick<GeoPoint, 'lat' | 'lon'>,
    signal?: AbortSignal,
): Promise<RouteGeometry | null> {
    const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const url = `${serviceUrl(urls, mode, 'route')}${coordinates}?overview=full&geometries=geojson&steps=true`;

    try {
        const response = await requestOsrm(url, signal);
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
        // Indisponibilité, délai dépassé, réponse illisible : l'appelant tranchera
        // ce qu'il en dit à l'utilisateur. On ne fabrique pas de tracé de repli.
        return null;
    }
}

/**
 * Distances et durées de toutes les origines vers toutes les destinations.
 * Une seule requête remplace jusqu'à huit appels individuels lors du choix
 * d'une station. Les valeurs `null` d'OSRM signalent un couple inaccessible.
 */
export async function fetchOsrmMatrix(
    urls: ServerConfig['osrmUrls'],
    mode: RoutableMode,
    origins: Array<Pick<GeoPoint, 'lat' | 'lon'>>,
    destinations: Array<Pick<GeoPoint, 'lat' | 'lon'>>,
    signal?: AbortSignal,
): Promise<Array<Array<RouteMeasure | null>> | null> {
    const points = [...origins, ...destinations];
    const coordinates = points.map((point) => `${point.lon},${point.lat}`).join(';');
    const sources = origins.map((_, index) => index).join(';');
    const destinationsIndexes = destinations.map((_, index) => origins.length + index).join(';');
    const query = new URLSearchParams({ sources, destinations: destinationsIndexes, annotations: 'distance,duration' });
    const url = `${serviceUrl(urls, mode, 'table')}${coordinates}?${query.toString()}`;

    try {
        const response = await requestOsrm(url, signal);
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
            destinations.map((__, destinationIndex) => routeMeasure(
                payload.distances[originIndex]?.[destinationIndex],
                payload.durations[originIndex]?.[destinationIndex],
            )),
        );
    } catch {
        return null;
    }
}
