// Contrat de la route de calcul d'itinéraire.
import { z } from 'zod';

/** Modes qui empruntent la voirie et peuvent donc être mesures par OSRM. */
// `car` est exclusivement un profil de mesure pour la référence carbone : il
// n'appartient pas a MobilityMode et ne peut donc jamais devenir une option.
export const ROUTABLE_MODES = ['walk', 'bike', 'scooter', 'car'] as const;
export const routableMode = z.enum(ROUTABLE_MODES);
export type RoutableMode = z.infer<typeof routableMode>;

export const routeInstruction = z.object({
    text: z.string(),
    distanceMeters: z.number().min(0),
    detail: z.string().optional(),
    kind: z.enum(['turn', 'roundabout', 'depart', 'arrive', 'transfer', 'continue']),
});
export type RouteInstruction = z.infer<typeof routeInstruction>;

export const routeGeometry = z.object({
    path: z.array(z.tuple([z.number(), z.number()])),
    distanceMeters: z.number().min(0),
    durationSeconds: z.number().min(0),
    instructions: z.array(routeInstruction),
    /** D'où vient la réponse : utile en revue, et pour mesurer le cache. */
    source: z.enum(['cache', 'upstream']),
});
export type RouteGeometry = z.infer<typeof routeGeometry>;

export const routeMeasure = z.object({
    distanceMeters: z.number().min(0),
    durationSeconds: z.number().min(0),
    source: z.enum(['cache', 'upstream']),
});
export type RouteMeasure = z.infer<typeof routeMeasure>;

export const routeMatrix = z.object({
    measures: z.array(z.array(routeMeasure.nullable())),
});
export type RouteMatrix = z.infer<typeof routeMatrix>;
