// Etat complet d'un compte : ce que le serveur rend a l'ouverture de session
// pour que le client amorce son cache. Il ne s'ecrit jamais en bloc : les
// collections exposent ensuite une route par ressource.
import { z } from 'zod';
import { sessionUser } from './auth';
import { plannedTrips, recurringTrips, savedRoutes, tripRecords } from './collections';
import { mobilityProfile } from './profile';

export const accountState = z.object({
    profile: mobilityProfile,
    tripRecords,
    plannedTrips,
    recurringTrips,
    savedRoutes,
});
export type AccountState = z.infer<typeof accountState>;

/** Reponse commune a l'inscription, la connexion et la reprise de session. */
export const session = z.object({ user: sessionUser, state: accountState });
export type Session = z.infer<typeof session>;

/** Export RGPD (art. 20) : l'etat complet, augmente des donnees de compte. */
export const accountExport = accountState.extend({
    exportedAt: z.string(),
    account: z.object({
        id: z.string(),
        email: z.string(),
        displayName: z.string(),
        createdAt: z.string(),
    }),
});
