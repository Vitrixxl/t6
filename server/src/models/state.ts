// Etat complet d'un compte : ce que le serveur renvoie pour hydrater le cache
// local du client apres une connexion.
import { t } from 'elysia';
import { mobilityProfile } from './profile.ts';
import { ownedPlannedTrip, ownedRecurringTrip, ownedSavedRoute, ownedTripRecord } from './trips.ts';
import { sessionUser } from './auth.ts';

export const userState = t.Object({
  profile: mobilityProfile,
  tripRecords: t.Array(ownedTripRecord),
  plannedTrips: t.Array(ownedPlannedTrip),
  recurringTrips: t.Array(ownedRecurringTrip),
  savedRoutes: t.Array(ownedSavedRoute),
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
