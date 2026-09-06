// Briques de base des contrats, partagées par le client et par l'API.
//
// Un contrat est un schéma zod. Il sert quatre fois à partir d'une seule
// source : il valide la requête côté serveur (Elysia le prend tel quel), il
// valide le formulaire côté client (react-hook-form), il type les deux
// (z.infer) et il génère la documentation OpenAPI. Une borne ecrite ici est
// donc la même dans le formulaire, dans la réponse 422 et dans la doc.
import { z } from 'zod';

export const MOBILITY_MODES = ['walk', 'bike', 'scooter', 'transit'] as const;
export const mobilityMode = z.enum(MOBILITY_MODES);
export type MobilityMode = z.infer<typeof mobilityMode>;

export const modes = z.array(mobilityMode).max(MOBILITY_MODES.length);
export const requiredModes = z.array(mobilityMode).min(1, 'Choisis au moins un mode.').max(MOBILITY_MODES.length);

export const identifier = z.string().min(1).max(200);
export const label = z.string().min(1, 'Le nom est obligatoire.').max(200, '200 caractères au plus.');
export const isoDate = z.iso.datetime();

export const distanceKm = z.number().min(0).max(2000);
export const durationMinutes = z.number().min(0).max(10_000);
export const carbonGrams = z.number().min(0).max(10_000_000);
// La comparaison dépend d'une mesure voiture sur la voirie. Son absence ne vaut jamais
// zéro : null dit explicitement que la référence n'était pas disponible.
export const carbonSavedGrams = z.number().min(-10_000_000).max(10_000_000).nullable();

export const geoPoint = z.object({
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    label,
    accuracyMeters: z.number().min(0).max(100_000).optional(),
});
export type GeoPoint = z.infer<typeof geoPoint>;

export const errorResponse = z.object({ error: z.string() });
export const okResponse = z.object({ ok: z.boolean() });

/** Origine, destination et mesures : le socle commun a tout déplacement. */
export const journeyShape = {
    origin: geoPoint,
    destination: geoPoint,
    modes,
    distanceKm,
    durationMinutes,
    carbonGrams,
    carbonSavedGrams,
};

/** Un trajet planifié porte en plus son intitule libre. Un itinéraire
 *  sauvegarde, lui, porte le titre de l'itinéraire calculé (routeTitle) : les
 *  deux formes sont donc distinctes, et ne se melangent pas. */
export const tripShape = {
    label,
    ...journeyShape,
};

/** Un enregistrement porte son proprietaire, que le serveur déduit de la
 *  session : le client ne l'envoie jamais (voir les formes `...Input`). */
export const owned = { userId: z.string() };
