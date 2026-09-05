import { z } from 'zod';
import { geoPoint } from './primitives';

const transitId = z.string().min(1).max(200);
const seconds = z.number().int().nonnegative().max(7 * 86400);
const coordinate = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

export const transitStop = z.object({
    stop_id: transitId,
    stop_name: z.string().min(1),
    stop_lat: z.number().min(-90).max(90),
    stop_lon: z.number().min(-180).max(180),
    wheelchair_boarding: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    parent_station: z.string(),
    routes: z.array(transitId),
});
export const transitRoute = z.object({
    route_id: transitId,
    route_short_name: z.string(),
    route_long_name: z.string(),
    route_type: z.union([z.literal(0), z.literal(1), z.literal(7)]),
    route_color: z.string().regex(/^[0-9a-fA-F]{6}$/),
    route_text_color: z.string().regex(/^[0-9a-fA-F]{6}$/),
    shape: z.array(coordinate),
});
export const transitNetwork = z.object({ stops: z.array(transitStop), routes: z.array(transitRoute) });
export const timetableMetadata = z.object({
    id: transitId,
    importedAt: z.iso.datetime(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    timeZone: z.string().refine((value) => {
        try { new Intl.DateTimeFormat('fr', { timeZone: value }); return true; } catch { return false; }
    }),
    maxTimeSeconds: seconds,
});
export const timetableStatus = z.object({ metadata: timetableMetadata.nullable(), network: transitNetwork });

export const timetablePassage = z.object({
    stopId: transitId,
    sequence: z.number().int().nonnegative(),
    arrival: seconds,
    departure: seconds,
    pickup: z.boolean(),
    dropoff: z.boolean(),
    shapeIndex: z.number().int().nonnegative(),
}).refine((value) => value.departure >= value.arrival, 'Le départ précède l’arrivée.');
export const timetableTrip = z.object({
    id: transitId,
    routeId: transitId,
    serviceId: transitId,
    shapeId: transitId,
    headsign: z.string(),
    accessible: z.boolean(),
    frequency: z.object({ start: seconds, end: seconds, headway: z.number().int().positive(), exact: z.boolean() })
        .refine((value) => value.end > value.start, 'Plage de fréquence inversée.').nullable(),
    passages: z.array(timetablePassage).min(2),
});
export const timetableTransfer = z.object({
    fromStopId: transitId,
    toStopId: transitId,
    minimumSeconds: seconds,
    forbidden: z.boolean(),
    estimated: z.boolean(),
});
export const timetableImport = z.object({
    metadata: timetableMetadata,
    network: transitNetwork,
    shapes: z.array(z.object({ id: transitId, points: z.array(coordinate).min(2) })),
    services: z.array(z.object({ serviceId: transitId, date: z.iso.date() })).min(1),
    trips: z.array(timetableTrip).min(1),
    transfers: z.array(timetableTransfer),
});

const stopAccess = z.object({ stopId: transitId, durationSeconds: seconds, distanceMeters: z.number().nonnegative() });
export const transitSearch = z.object({
    departureAt: z.iso.datetime({ offset: true }),
    requireAccessible: z.boolean(),
    departures: z.array(stopAccess).min(1).max(8),
    arrivals: z.array(stopAccess).min(1).max(8),
});
// Une collection calculée reste une lecture GET ; le contrat borne les listes
// de candidats transmises dans le paramètre, pas les options affichées.
function decodeSearch(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    if (value.length > 8000) return null;
    try { return JSON.parse(value); } catch { return null; }
}
export const transitJourneyQuery = z.object({ search: z.preprocess(decodeSearch, transitSearch) });
export const scheduledRide = z.object({
    tripId: transitId,
    routeId: transitId,
    headsign: z.string(),
    boarding: transitStop,
    alighting: transitStop,
    readyAt: z.iso.datetime(),
    departureAt: z.iso.datetime(),
    arrivalAt: z.iso.datetime(),
    transferSeconds: seconds,
    transferEstimated: z.boolean(),
    timing: z.enum(['scheduled', 'frequency']),
    path: z.array(geoPoint).min(2),
});
export const scheduledJourney = z.object({
    rides: z.array(scheduledRide).min(1).max(2),
    departureAccess: stopAccess,
    arrivalAccess: stopAccess,
    arrivalAt: z.iso.datetime(),
    durationSeconds: z.number().nonnegative(),
});
export const transitJourneyResult = z.object({
    status: z.enum(['ready', 'no-service', 'unavailable', 'outside-coverage']),
    metadata: timetableMetadata.nullable(),
    journey: scheduledJourney.nullable(),
});

export type TransitNetwork = z.infer<typeof transitNetwork>;
export type TimetableMetadata = z.infer<typeof timetableMetadata>;
export type TimetableImport = z.infer<typeof timetableImport>;
export type TimetableTrip = z.infer<typeof timetableTrip>;
export type TimetableTransfer = z.infer<typeof timetableTransfer>;
export type TransitSearch = z.infer<typeof transitSearch>;
export type ScheduledRide = z.infer<typeof scheduledRide>;
export type ScheduledJourney = z.infer<typeof scheduledJourney>;
export type TransitJourneyResult = z.infer<typeof transitJourneyResult>;
