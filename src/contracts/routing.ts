// Contrat de la route de calcul d'itinéraire.
import { z } from 'zod';
import { geoPoint } from './primitives';

/** Modes qui empruntent la voirie et peuvent donc être mesures par OSRM. */
// `car` est exclusivement un profil de mesure pour la référence carbone : il
// n'appartient pas a MobilityMode et ne peut donc jamais devenir une option.
export const ROUTABLE_MODES = ['walk', 'bike', 'scooter', 'car'] as const;
export const routableMode = z.enum(ROUTABLE_MODES);
export type RoutableMode = z.infer<typeof routableMode>;

/**
 * Les coordonnées arrivent en chaîne dans la requête (`?from=4.83,45.75`) :
 * une paire tient en un paramètre, et le format est lisible dans un journal
 * comme dans une barre d'adresse.
 *
 * Le nombre de décimales n'est volontairement pas borné. Une première version
 * le limitait a sept, ce qui rejetait cinquante-deux des quatre cent
 * soixante-cinq stations Vélo'v du flux GBFS, publiées avec treize décimales :
 * tout itinéraire passant par l'une d'elles échouait en 422, que le client
 * traduisait par « service de routage indisponible » (B15). Une contrainte de
 * validation doit borner ce qui est dangereux — ici la longueur totale — sans
 * decreter une précision que la source ne respecte pas.
 *
 * Elysia decoupe sur la virgule toute valeur de requête validée par un
 * schéma qu'il ne connaît pas : la paire arrive donc en tableau de deux
 * chaines, que le contrat recolle avant de la verifier. La documentation
 * OpenAPI, elle, décrit bien une chaîne.
 */
const coordinatePair = z.preprocess(
    (value) => (Array.isArray(value) ? value.join(',') : value),
    z.string().regex(/^-?\d{1,3}(\.\d+)?,-?\d{1,2}(\.\d+)?$/).max(48),
);

export const routeQuery = z.object({
    mode: routableMode,
    from: coordinatePair,
    to: coordinatePair,
});

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

/**
 * Une matrice borne les appels nécessaires pour classer quelques points d'accès
 * par temps réel. Chaque categorie garde huit candidats ; une requête agrege
 * plusieurs catégories, d'où un maximum de trente-deux points par axe.
 */
const routeMatrixPoints = z.array(geoPoint.pick({ lat: true, lon: true })).min(1).max(32);

export const routeMatrixRequest = z.object({
    mode: routableMode,
    origins: routeMatrixPoints,
    destinations: routeMatrixPoints,
});
export type RouteMatrixRequest = z.infer<typeof routeMatrixRequest>;

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
