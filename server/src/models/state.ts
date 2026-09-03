// Etat complet d'un compte : ce que le serveur renvoie a l'ouverture de
// session pour que le client le tienne en memoire. Il ne s'ecrit jamais en
// bloc : chaque collection a son propre PUT (models/collections.ts).
import { t } from 'elysia';
import { mobilityProfile } from './profile.ts';
import { ownedPlannedTrips, ownedRecurringTrips, ownedSavedRoutes, ownedTripRecords } from './collections.ts';
import { sessionUser } from './auth.ts';

export const userState = t.Object({
  profile: mobilityProfile,
  tripRecords: ownedTripRecords,
  plannedTrips: ownedPlannedTrips,
  recurringTrips: ownedRecurringTrips,
  savedRoutes: ownedSavedRoutes,
});

/** Reponse commune a l'inscription, la connexion et la reprise de session. */
export const authenticatedResponse = t.Object({ user: sessionUser, state: userState });

/** Export RGPD (art. 20) : l'etat complet, augmente des donnees de compte. */
export const accountExport = t.Object({
  exportedAt: t.String(),
  account: t.Object({
    id: t.String(),
    email: t.String(),
    displayName: t.String(),
    createdAt: t.String(),
  }),
  ...userState.properties,
});
