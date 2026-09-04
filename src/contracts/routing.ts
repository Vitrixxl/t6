// Contrat de la route de calcul d'itineraire.
import { z } from 'zod';
import { geoPoint } from './primitives';

/** Modes qui empruntent la voirie et peuvent donc etre mesures par OSRM. */
// `car` est exclusivement un profil de mesure pour la reference carbone : il
// n'appartient pas a MobilityMode et ne peut donc jamais devenir une option.
export const ROUTABLE_MODES = ['walk', 'bike', 'scooter', 'car'] as const;
export const routableMode = z.enum(ROUTABLE_MODES);
export type RoutableMode = z.infer<typeof routableMode>;

/**
 * Les coordonnees arrivent en chaine dans la requete (`?from=4.83,45.75`) :
 * une paire tient en un parametre, et le format est lisible dans un journal
 * comme dans une barre d'adresse.
 *
 * Le nombre de decimales n'est volontairement pas borne. Une premiere version
 * le limitait a sept, ce qui rejetait cinquante-deux des quatre cent
 * soixante-cinq stations Velo'v du flux GBFS, publiees avec treize decimales :
 * tout itineraire passant par l'une d'elles echouait en 422, que le client
 * traduisait par « service de routage indisponible » (B15). Une contrainte de
 * validation doit borner ce qui est dangereux — ici la longueur totale — sans
 * decreter une precision que la source ne respecte pas.
 *
 * Elysia decoupe sur la virgule toute valeur de requete validee par un
 * schema qu'il ne connait pas : la paire arrive donc en tableau de deux
 * chaines, que le contrat recolle avant de la verifier. La documentation
 * OpenAPI, elle, decrit bien une chaine.
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
    /** D'ou vient la reponse : utile en revue, et pour mesurer le cache. */
    source: z.enum(['cache', 'upstream']),
});
export type RouteGeometry = z.infer<typeof routeGeometry>;

/**
 * Une matrice borne les appels necessaires pour classer quelques points d'acces
 * par temps reel. Chaque categorie garde huit candidats ; une requete agrege
 * plusieurs categories, d'ou un maximum de trente-deux points par axe.
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
