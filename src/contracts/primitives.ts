// Briques de base des contrats, partagees par le client et par l'API.
//
// Un contrat est un schema zod. Il sert quatre fois a partir d'une seule
// source : il valide la requete cote serveur (Elysia le prend tel quel), il
// valide le formulaire cote client (react-hook-form), il type les deux
// (z.infer) et il genere la documentation OpenAPI. Une borne ecrite ici est
// donc la meme dans le formulaire, dans la reponse 422 et dans la doc.
import { z } from 'zod';

export const MOBILITY_MODES = ['walk', 'bike', 'scooter', 'transit'] as const;
export const mobilityMode = z.enum(MOBILITY_MODES);
export type MobilityMode = z.infer<typeof mobilityMode>;

export const modes = z.array(mobilityMode).max(MOBILITY_MODES.length);
export const requiredModes = z.array(mobilityMode).min(1, 'Choisis au moins un mode.').max(MOBILITY_MODES.length);

export const identifier = z.string().min(1).max(200);
export const label = z.string().min(1, 'Le nom est obligatoire.').max(200, '200 caracteres au plus.');
export const isoDate = z.iso.datetime();

export const distanceKm = z.number().min(0).max(2000);
export const durationMinutes = z.number().min(0).max(10_000);
export const carbonGrams = z.number().min(0).max(10_000_000);
export const carbonSavedGrams = z.number().min(-10_000_000).max(10_000_000);

export const geoPoint = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  label,
  accuracyMeters: z.number().min(0).max(100_000).optional(),
});
export type GeoPoint = z.infer<typeof geoPoint>;

export const errorResponse = z.object({ error: z.string() });
export const okResponse = z.object({ ok: z.boolean() });

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

/** Un enregistrement porte son proprietaire, que le serveur deduit de la
 *  session : le client ne l'envoie jamais (voir les formes `...Input`). */
export const owned = { userId: z.string() };
