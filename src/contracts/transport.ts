// Réseau importé et ressources de transport servies au navigateur.
import { z } from 'zod';

export const occupancy = z.enum(['low', 'medium', 'high']);
export const gtfsAgency = z.object({
    agency_id: z.string(), agency_name: z.string(), agency_url: z.string(), agency_timezone: z.string(),
});
export const gtfsStop = z.object({
    stop_id: z.string(), stop_name: z.string(),
    stop_lat: z.number().min(-90).max(90), stop_lon: z.number().min(-180).max(180),
    wheelchair_boarding: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    routes: z.array(z.string()),
});
export const gtfsRoute = z.object({
    route_id: z.string(), route_short_name: z.string(), route_long_name: z.string(),
    route_type: z.number(), route_color: z.string(), route_text_color: z.string(),
    shape: z.array(z.tuple([z.number(), z.number()])),
    stopSequence: z.array(z.string()).optional(), wheelchairAccessible: z.boolean().optional(),
});
export const gtfsTrip = z.object({
    trip_id: z.string(), route_id: z.string(), service_id: z.string(),
    headway_minutes: z.number(), realtime_delay_minutes: z.number(), occupancy,
});
export const gtfsFeed = z.object({
    agency: gtfsAgency, stops: z.array(gtfsStop), routes: z.array(gtfsRoute),
    trips: z.array(gtfsTrip),
});
export const sharedStation = z.object({
    station_id: z.string(), kind: z.enum(['velov', 'scooter']), name: z.string(),
    lat: z.number(), lon: z.number(), capacity: z.number(),
    bikes_available: z.number(), scooters_available: z.number(),
    is_installed: z.boolean(), is_renting: z.boolean(), is_returning: z.boolean(), last_reported: z.number(),
});
export const sharedMobilityFeed = z.object({
    last_updated: z.number(), ttl: z.number(), version: z.string(), data: z.object({ stations: z.array(sharedStation) }),
});
export const transportContext = z.object({
    version: z.string(), stopCount: z.number().int().nonnegative(), agency: gtfsAgency,
    sharedMobility: sharedMobilityFeed.nullable(),
    sources: z.object({ gtfs: z.enum(['tcl-odbl', 'local']) }),
});

// Des cellules stables se réutilisent entre deux cadrages voisins ; un rectangle
// arbitraire créerait une nouvelle clé de cache au moindre déplacement.
export const STOP_CELLS_PER_DEGREE = 20;
export const STOP_MIN_ZOOM = 11;
export const stopCellQuery = z.object({
    x: z.coerce.number().int().min(-3600).max(3599),
    y: z.coerce.number().int().min(-1800).max(1799),
    version: z.string().min(1).max(64),
});
export const stopCollection = z.object({ stops: z.array(gtfsStop) });
export const MAX_NEARBY_RADIUS_KM = 1000;
export const nearbyStopsQuery = z.object({
    lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180),
    radiusKm: z.coerce.number().positive().max(MAX_NEARBY_RADIUS_KM),
});
export const nearbyStops = z.object({
    count: z.number().int().nonnegative(),
    items: z.array(z.object({ item: gtfsStop, distanceKm: z.number().nonnegative() })),
});
export type Occupancy = z.infer<typeof occupancy>;
export type GtfsAgency = z.infer<typeof gtfsAgency>;
export type GtfsStop = z.infer<typeof gtfsStop>;
export type GtfsRoute = z.infer<typeof gtfsRoute>;
export type GtfsTrip = z.infer<typeof gtfsTrip>;
export type GtfsFeed = z.infer<typeof gtfsFeed>;
export type SharedStation = z.infer<typeof sharedStation>;
export type SharedMobilityFeed = z.infer<typeof sharedMobilityFeed>;
export type TransportContext = z.infer<typeof transportContext>;

export type NetworkSources = TransportContext['sources'];
