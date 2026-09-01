// Contrat de la route de calcul d'itineraire.
import { t } from 'elysia';
import { mode } from './primitives.ts';

/**
 * Les coordonnees arrivent en chaine dans la requete (`?from=4.83,45.75`) :
 * une paire tient en un parametre, et le format est lisible dans un journal
 * comme dans une barre d'adresse.
 */
const coordinatePair = t.String({ pattern: '^-?\\d{1,3}(\\.\\d{1,7})?,-?\\d{1,2}(\\.\\d{1,7})?$', maxLength: 48 });

export const routeQuery = t.Object({
  mode,
  from: coordinatePair,
  to: coordinatePair,
});

export const routeGeometry = t.Object({
  path: t.Array(t.Tuple([t.Number(), t.Number()])),
  distanceMeters: t.Number({ minimum: 0 }),
  durationSeconds: t.Number({ minimum: 0 }),
  instructions: t.Array(
    t.Object({
      text: t.String(),
      distanceMeters: t.Number({ minimum: 0 }),
      detail: t.Optional(t.String()),
      kind: t.Union([
        t.Literal('turn'),
        t.Literal('roundabout'),
        t.Literal('depart'),
        t.Literal('arrive'),
        t.Literal('transfer'),
        t.Literal('continue'),
      ]),
    }),
  ),
  /** D'ou vient la reponse : utile en revue, et pour mesurer le cache. */
  source: t.Union([t.Literal('cache'), t.Literal('upstream')]),
});
