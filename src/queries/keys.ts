// Cles du cache de requetes. Les declarer ici, et nulle part ailleurs, evite
// qu'une lecture et une invalidation designent la meme donnee par deux
// chaines differentes.
import type { GeoPoint, MobilityProfile } from '../types';

export const queryKeys = {
    session: ['session'],
    /** Prefixe commun, utilise uniquement pour purger le compte a la deconnexion. */
    account: ['account'],
    profile: ['account', 'profile'],
    tripRecords: ['account', 'tripRecords'],
    plannedTrips: ['account', 'plannedTrips'],
    recurringTrips: ['account', 'recurringTrips'],
    savedRoutes: ['account', 'savedRoutes'],
    transportNetwork: ['transport-network'],
    // Les extremites et le profil determinent les options calculees, donc leur
    // mesure ; le libelle d'un point n'y change rien.
    measuredRoutes: (origin: GeoPoint, destination: GeoPoint, profile: MobilityProfile) =>
        [
            'measured-routes',
            { origin: { lat: origin.lat, lon: origin.lon }, destination: { lat: destination.lat, lon: destination.lon }, profile },
        ],
} as const;

export const mutationKeys = {
    /** Prefixe de tout ce qui ecrit le compte : c'est ce que la banniere d'erreur observe. */
    account: ['account'],
    deleteAccount: ['account', 'delete'],
    profileSave: ['account', 'profile-save'],
    plannedSave: ['account', 'planned-save'],
    plannedComplete: ['account', 'planned-complete'],
    plannedDelete: ['account', 'planned-delete'],
    recurringSave: ['account', 'recurring-save'],
    recurringDelete: ['account', 'recurring-delete'],
    savedRouteSave: ['account', 'saved-route-save'],
    savedRouteDelete: ['account', 'saved-route-delete'],
    historyClear: ['account', 'history-clear'],
} as const;
