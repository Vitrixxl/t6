// Cles du cache de requetes. Les declarer ici, et nulle part ailleurs, evite
// qu'une lecture et une invalidation designent la meme donnee par deux
// chaines differentes.
import type { GeoPoint, MobilityProfile } from '../types';
import type { AccountPart } from '../lib/api';

export const queryKeys = {
    session: ['session'],
    /** Prefixe de toutes les parties du compte : invalider ici les touche toutes. */
    account: ['account'],
    accountPart: <P extends AccountPart>(part: P) => ['account', part],
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
    accountWrite: ['account', 'write'],
    deleteAccount: ['account', 'delete'],
} as const;
