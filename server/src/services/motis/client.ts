// Protocole MOTIS : construction des requêtes et lecture validée des réponses.
//
// MOTIS calcule les itinéraires multimodaux sur un graphe unique : voirie
// OpenStreetMap, horaires GTFS et flux GBFS. Une requête `plan` rend les
// trajets non dominés entre deux points ; `one-to-many` mesure la voirie seule,
// ce qui sert à la référence voiture.
import { z } from 'zod';
import type { GeoPoint, RouteMeasure } from '../../../../src/types.ts';

const MOTIS_TIMEOUT_MS = 15_000;
/**
 * MOTIS coupe les trajets directs à 30 min par défaut. La marche reste toujours
 * proposée, même sur une traversée de la métropole ; un engin partagé au-delà
 * d'une heure et demie n'est plus une option raisonnable.
 */
const MAX_DIRECT_SECONDS: Record<MotisAccess, number> = { WALK: 4 * 3600, BICYCLE: 90 * 60, SCOOTER_STANDING: 90 * 60 };

/** Moyen d'accès au transport, et trajet direct du même mode. */
export type MotisAccess = 'WALK' | 'BICYCLE' | 'SCOOTER_STANDING';

export interface PlanQuery {
    from: Pick<GeoPoint, 'lat' | 'lon'>;
    to: Pick<GeoPoint, 'lat' | 'lon'>;
    /** Heure de départ ISO 8601. */
    departureAt: string;
    /** Modes de transport MOTIS autorisés (TRAM, SUBWAY, BUS, FUNICULAR). */
    transitModes: string[];
    access: MotisAccess;
    wheelchair: boolean;
}

const place = z.object({
    name: z.string(),
    lat: z.number(),
    lon: z.number(),
    stopId: z.string().optional(),
});
const encodedPolyline = z.object({ points: z.string(), precision: z.number().int() });
const rental = z.object({
    systemName: z.string().optional(),
    formFactor: z.string().optional(),
    fromStationName: z.string().optional(),
    toStationName: z.string().optional(),
});
const leg = z.object({
    mode: z.string(),
    from: place,
    to: place,
    /** Secondes. */
    duration: z.number(),
    /** Mètres, absent sur les segments de transport. */
    distance: z.number().optional(),
    legGeometry: encodedPolyline,
    routeShortName: z.string().optional(),
    routeColor: z.string().optional(),
    routeType: z.number().int().optional(),
    headsign: z.string().optional(),
    wheelchairAccessible: z.string().optional(),
    rental: rental.optional(),
});
const itinerary = z.object({
    /** Secondes, attentes comprises. */
    duration: z.number(),
    startTime: z.string(),
    endTime: z.string(),
    transfers: z.number().int(),
    legs: z.array(leg).min(1),
});
const planResponse = z.object({
    direct: z.array(itinerary).default([]),
    itineraries: z.array(itinerary).default([]),
});
const oneToManyResponse = z.array(z.object({ duration: z.number(), distance: z.number().optional() }));

export type MotisLeg = z.infer<typeof leg>;
export type MotisItinerary = z.infer<typeof itinerary>;

async function requestJson(url: string, signal?: AbortSignal): Promise<unknown | null> {
    try {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.any([AbortSignal.timeout(MOTIS_TIMEOUT_MS), ...(signal ? [signal] : [])]),
        });
        return response.ok ? await response.json() : null;
    } catch {
        // Indisponibilité, délai dépassé, réponse illisible : l'appelant tranchera
        // ce qu'il en dit à l'utilisateur. On ne fabrique pas de trajet de repli.
        return null;
    }
}

function coordinate(point: Pick<GeoPoint, 'lat' | 'lon'>, separator: ',' | ';'): string {
    return `${point.lat}${separator}${point.lon}`;
}

export function planUrl(baseUrl: string, query: PlanQuery): string {
    const params = new URLSearchParams({
        fromPlace: coordinate(query.from, ','),
        toPlace: coordinate(query.to, ','),
        time: query.departureAt,
        pedestrianProfile: query.wheelchair ? 'WHEELCHAIR' : 'FOOT',
        postTransitModes: 'WALK',
        numItineraries: '5',
        maxDirectTime: String(MAX_DIRECT_SECONDS[query.access]),
    });
    if (query.transitModes.length > 0) {
        params.set('transitModes', query.transitModes.join(','));
    } else {
        // Sans mode de transport, MOTIS ne rend rien du tout, pas même les trajets
        // directs. Une durée maximale d'une minute exclut tout trajet avec
        // transport ; les trajets directs ne sont pas concernés par cette borne.
        params.set('maxTravelTime', '1');
    }
    if (query.access === 'WALK') {
        params.set('preTransitModes', 'WALK');
        params.set('directModes', 'WALK');
    } else {
        params.set('preTransitModes', 'RENTAL');
        params.set('preTransitRentalFormFactors', query.access);
        params.set('directModes', 'RENTAL');
        params.set('directRentalFormFactors', query.access);
    }
    return `${baseUrl}/api/v6/plan?${params.toString()}`;
}

/** Trajets directs et itinéraires avec transport, ou `null` si MOTIS ne répond pas. */
export async function fetchPlan(baseUrl: string, query: PlanQuery, signal?: AbortSignal): Promise<MotisItinerary[] | null> {
    const parsed = planResponse.safeParse(await requestJson(planUrl(baseUrl, query), signal));
    return parsed.success ? [...parsed.data.direct, ...parsed.data.itineraries] : null;
}

/** Distance et durée en voiture entre deux points, ou `null` si inaccessible ou en panne. */
export async function fetchCarMeasure(
    baseUrl: string,
    from: Pick<GeoPoint, 'lat' | 'lon'>,
    to: Pick<GeoPoint, 'lat' | 'lon'>,
    signal?: AbortSignal,
): Promise<RouteMeasure | null> {
    const params = new URLSearchParams({
        one: coordinate(from, ';'),
        many: coordinate(to, ';'),
        mode: 'CAR',
        max: '7200',
        maxMatchingDistance: '250',
        arriveBy: 'false',
        withDistance: 'true',
    });
    const parsed = oneToManyResponse.safeParse(await requestJson(`${baseUrl}/api/v1/one-to-many?${params.toString()}`, signal));
    const cell = parsed.success ? parsed.data[0] : undefined;
    return cell && cell.distance !== undefined && cell.distance >= 0 && cell.duration >= 0
        ? { distanceMeters: cell.distance, durationSeconds: cell.duration }
        : null;
}
