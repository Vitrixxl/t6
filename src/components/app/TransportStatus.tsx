import type { TransportContext } from '../../types';

/** Les limites des sources restent distinctes du signal hors ligne du navigateur. */
export function TransportStatus({ network }: { network: TransportContext }) {
    return <>
        {!network.transitRoutingAvailable && (
            <div role="status" className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Les horaires TCL seront intégrés dans une prochaine version. Les recherches utilisent la marche, Vélo’v et Dott selon leurs disponibilités ; les arrêts restent consultables sur la carte.
            </div>
        )}
        {network.sharedMobility === null && (
            <div role="status" className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                Impossible de récupérer les disponibilités Vélo’v et Dott. Les itinéraires vélo et trottinette sont indisponibles.
            </div>
        )}
    </>;
}
