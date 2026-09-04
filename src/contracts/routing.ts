// Contrat de la route de calcul d'itineraire.
import { z } from 'zod';
import { mobilityMode } from './primitives';

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
  mode: mobilityMode,
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
