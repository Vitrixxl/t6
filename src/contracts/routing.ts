// Modes mesurables par OSRM et instructions de guidage d'une option.
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
