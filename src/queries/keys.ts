// Clés du cache de requêtes. Les declarer ici, et nulle part ailleurs, évite
// qu'une lecture et une invalidation désignent la même donnée par deux
// chaines différentes.
import type { GeoPoint, MobilityProfile } from '../types';
import { ALL_TRANSIT_TYPES, type TransitType } from '../lib/planner/transit-filter';

export const queryKeys = {
    session: ['session'],
    /** Préfixe commun, utilise uniquement pour purger le compte à la déconnexion. */
    account: ['account'],
    profile: ['account', 'profile'],
    tripRecords: ['account', 'tripRecords'],
    plannedTrips: ['account', 'plannedTrips'],
    recurringTrips: ['account', 'recurringTrips'],
    savedRoutes: ['account', 'savedRoutes'],
    transportNetwork: ['transport-network'],
    // Les extrémités et le profil determinent les options calculées, donc leur
    // mesure ; le libellé d'un point n'y change rien.
    measuredRoutes: (origin: GeoPoint, destination: GeoPoint, profile: MobilityProfile, transitTypes: readonly TransitType[] = ALL_TRANSIT_TYPES) =>
        [
            'measured-routes',
            { origin: { lat: origin.lat, lon: origin.lon }, destination: { lat: destination.lat, lon: destination.lon }, profile, transitTypes },
        ],
} as const;

export const mutationKeys = {
    /** Préfixe de tout ce qui ecrit le compte : c'est ce que la banniere d'erreur observe. */
    account: ['account'],
    deleteAccount: ['account', 'delete'],
    profileSave: ['account', 'profile-save'],
    plannedSave: ['account', 'planned-save'],
    plannedRestore: ['account', 'planned-restore'],
    plannedCancel: ['account', 'planned-cancel'],
    plannedDelete: ['account', 'planned-delete'],
    recurringRestore: ['account', 'recurring-restore'],
    recurringCancel: ['account', 'recurring-cancel'],
    recurringSave: ['account', 'recurring-save'],
    recurringDelete: ['account', 'recurring-delete'],
    savedRouteSave: ['account', 'saved-route-save'],
    savedRouteDelete: ['account', 'saved-route-delete'],
    historyClear: ['account', 'history-clear'],
} as const;
