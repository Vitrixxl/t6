// Le résultat complet du moteur traverse désormais l'API : son contrat est
// partagé, notamment les géométries réelles et la référence carbone nullable.
import { z } from 'zod';
import { geoPoint, mobilityMode } from './primitives';
import { mobilityProfile } from './profile';
import { routeInstruction } from './routing';

export const transitType = z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]);
export const routeSearch = z.object({
    origin: geoPoint, destination: geoPoint, profile: mobilityProfile,
    transitTypes: z.array(transitType).max(4),
    sharedMobilityAvailable: z.boolean(),
    /** Heure de départ ISO 8601 ; absente, la recherche part maintenant. */
    departureAt: z.iso.datetime({ offset: true }).optional(),
});
export const legEstimate = z.object({
    travelFactor: z.number(), overheadMinutes: z.number(), carbonGramsPerKm: z.number(),
});
export const routeLeg = z.object({
    id: z.string(), mode: mobilityMode, transfer: z.boolean().optional(), title: z.string(),
    mapLabel: z.string().optional(), mapColor: z.string().optional(), from: z.string(), to: z.string(),
    fromPoint: geoPoint, toPoint: geoPoint, path: z.array(geoPoint), distanceKm: z.number(),
    durationMinutes: z.number(), carbonGrams: z.number(), accessible: z.boolean(), detail: z.string(), estimate: legEstimate,
});
export const carbonReference = z.object({ distanceKm: z.number(), carbonGrams: z.number(), factorVersion: z.string() });
export const routeOption = z.object({
    id: z.string(), title: z.string(), summary: z.string(), modes: z.array(mobilityMode),
    legs: z.array(routeLeg), path: z.array(geoPoint), distanceKm: z.number(), durationMinutes: z.number(),
    carbonGrams: z.number(), carbonSavedGrams: z.number().nullable(), carbonReference: carbonReference.nullable(),
    reliabilityScore: z.number(), score: z.number(), accessible: z.boolean(), warnings: z.array(z.string()),
    instructions: z.array(routeInstruction),
});
export const routeOptions = z.array(routeOption);
export type RouteSearchRequest = z.infer<typeof routeSearch>;
export type LegEstimate = z.infer<typeof legEstimate>;
export type RouteLeg = z.infer<typeof routeLeg>;
export type CarbonReference = z.infer<typeof carbonReference>;
export type RouteOption = z.infer<typeof routeOption>;
