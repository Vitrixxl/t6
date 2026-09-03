// Briques de base des contrats d'API, partagees par tous les schemas.
//
// Les contrats sont decrits avec le validateur natif d'Elysia (TypeBox). C'est
// la convention du framework, et elle a trois effets a la fois : la requete est
// validee avant d'atteindre le gestionnaire, le type TypeScript du gestionnaire
// en est deduit (pas de cast, pas de `any`), et la documentation OpenAPI est
// generee a partir de ces memes schemas. Une source de verite unique pour la
// validation, le typage et la documentation.
import { t } from 'elysia';

// L'union est ecrite en toutes lettres plutot que derivee d'un tableau : c'est
// la forme litterale qui permet a TypeBox d'inferer le type exact des modes
// (une union de chaines) et non un `never` inexploitable.
export const mode = t.Union([
  t.Literal('walk'),
  t.Literal('bike'),
  t.Literal('scooter'),
  t.Literal('transit'),
]);

const MODE_COUNT = 4;

export const modes = t.Array(mode, { maxItems: MODE_COUNT });
export const requiredModes = t.Array(mode, { minItems: 1, maxItems: MODE_COUNT });

export const identifier = t.String({ minLength: 1, maxLength: 200 });
export const label = t.String({ minLength: 1, maxLength: 200 });
export const isoDate = t.String({ format: 'date-time' });

export const distanceKm = t.Number({ minimum: 0, maximum: 2000 });
export const durationMinutes = t.Number({ minimum: 0, maximum: 10_000 });
export const carbonGrams = t.Number({ minimum: 0, maximum: 10_000_000 });
export const carbonSavedGrams = t.Number({ minimum: -10_000_000, maximum: 10_000_000 });

export const geoPoint = t.Object({
  lat: t.Number({ minimum: -90, maximum: 90 }),
  lon: t.Number({ minimum: -180, maximum: 180 }),
  label,
  accuracyMeters: t.Optional(t.Number({ minimum: 0, maximum: 100_000 })),
});

export const errorResponse = t.Object({ error: t.String() });
export const okResponse = t.Object({ ok: t.Boolean() });

/** Origine, destination et mesures : le socle commun a tout deplacement. */
export const journeyShape = {
  origin: geoPoint,
  destination: geoPoint,
  modes,
  distanceKm,
  durationMinutes,
  carbonGrams,
  carbonSavedGrams,
};

/** Un trajet planifie porte en plus son intitule libre. Un itineraire
 *  sauvegarde, lui, porte le titre de l'itineraire calcule (routeTitle) : les
 *  deux formes sont donc distinctes, et ne se melangent pas. */
export const tripShape = {
  label,
  ...journeyShape,
};

/** Un enregistrement tel qu'il est renvoye au client : porte son proprietaire. */
export const owned = { userId: t.String() };
