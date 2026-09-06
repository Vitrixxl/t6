// Le résultat complet du moteur traverse l'API : son contrat est partagé,
// notamment les géométries réelles et la référence carbone nullable.
import { z } from 'zod';
import { availableModes, geoPoint, mobilityMode } from './primitives';
import { routeInstruction } from './routing';

export const transitType = z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]);
/** Une recherche : ses extrémités, ce que l'utilisateur peut prendre pour ce trajet, son besoin PMR. */
export const routeSearch = z.object({
    origin: geoPoint, destination: geoPoint,
    modes: availableModes,
    transitTypes: z.array(transitType).max(4),
    accessibilityNeed: z.boolean(),
    /** Heure de départ ISO 8601 ; absente, la recherche part maintenant. */
    departureAt: z.iso.datetime({ offset: true }).optional(),
});
export const legEstimate = z.object({
    travelFactor: z.number(), overheadMinutes: z.number(), carbonGramsPerKm: z.number(),
});
export const routeLeg = z.object({
    id: z.string(), mode: mobilityMode, transfer: z.boolean().optional(), title: z.string(),
    transitType: transitType.optional(), lineCode: z.string().optional(),
    boardingAt: z.iso.datetime({ offset: true }).optional(), waitingSeconds: z.number().int().nonnegative().optional(),
    mapLabel: z.string().optional(), mapColor: z.string().optional(), from: z.string(), to: z.string(),
    fromPoint: geoPoint, toPoint: geoPoint, path: z.array(geoPoint), distanceKm: z.number(),
    durationMinutes: z.number(), carbonGrams: z.number(), accessible: z.boolean(), detail: z.string(), estimate: legEstimate,
});
export const carbonReference = z.object({ distanceKm: z.number(), carbonGrams: z.number(), factorVersion: z.string() });
/** Le trajet le plus rapide avec les moyens demandés : celui qui arrive le premier, attentes comprises. */
export const routeOption = z.object({
    id: z.string(), title: z.string(), summary: z.string(), modes: z.array(mobilityMode),
    legs: z.array(routeLeg), path: z.array(geoPoint), distanceKm: z.number(), durationMinutes: z.number(),
    departureAt: z.iso.datetime({ offset: true }), arrivalAt: z.iso.datetime({ offset: true }),
    carbonGrams: z.number(), carbonSavedGrams: z.number().nullable(), carbonReference: carbonReference.nullable(),
    accessible: z.boolean(), instructions: z.array(routeInstruction),
});
export type RouteSearchRequest = z.infer<typeof routeSearch>;
export type LegEstimate = z.infer<typeof legEstimate>;
export type RouteLeg = z.infer<typeof routeLeg>;
export type CarbonReference = z.infer<typeof carbonReference>;
export type RouteOption = z.infer<typeof routeOption>;
