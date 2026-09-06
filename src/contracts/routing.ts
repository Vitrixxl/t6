// Instructions de guidage d'une option.
import { z } from 'zod';

export const routeInstruction = z.object({
    text: z.string(),
    distanceMeters: z.number().min(0),
    detail: z.string().optional(),
    kind: z.enum(['turn', 'roundabout', 'depart', 'arrive', 'transfer', 'continue']),
});
export type RouteInstruction = z.infer<typeof routeInstruction>;
