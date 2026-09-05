import type { TransportContext, TransportNetwork } from '../../../../src/types.ts';
import { loadTransportNetwork } from '../../../../src/lib/transport/feeds/index.ts';
import { findWithinRadius } from '../../../../src/lib/planner/nearby.ts';
import { STOP_CELLS_PER_DEGREE } from '../../../../src/contracts/transport.ts';
import type { TransportRepository } from '../../repositories/transport.ts';

export function createTransportService(repository: TransportRepository) {
    const gtfs = repository.readNetwork();
    const metadata = repository.metadata();
    if (!metadata) throw new Error('Réseau TCL non importé.');
    const version = metadata.version;
    let live: Promise<TransportNetwork> | undefined;
    let expiresAt = 0;

    function network(): Promise<TransportNetwork> {
        if (!live || Date.now() >= expiresAt) {
            // Un seul chargement pour les visiteurs simultanés. Après expiration,
            // une panne produit null ; aucune ancienne disponibilité n'est reprise.
            expiresAt = Date.now() + 60_000;
            live = loadTransportNetwork(gtfs);
        }
        return live;
    }

    return {
        network,
        async context(): Promise<TransportContext> {
            const current = await network();
            return {
                version, stopCount: gtfs.stops.length, agency: gtfs.agency,
                sharedMobility: current.sharedMobility,
                sources: current.sources ?? { gtfs: 'tcl-odbl' },
            };
        },
        stops(x: number, y: number) {
            return { stops: repository.stopsInBounds({
                west: x / STOP_CELLS_PER_DEGREE, east: (x + 1) / STOP_CELLS_PER_DEGREE,
                south: y / STOP_CELLS_PER_DEGREE, north: (y + 1) / STOP_CELLS_PER_DEGREE,
            }) };
        },
        nearby(lat: number, lon: number, radiusKm: number) {
            // Le rectangle inclut le cercle ; le calcul sphérique filtre ensuite
            // ses coins et fournit le vrai compte, indépendamment des quatre lignes affichées.
            const latitudeDelta = radiusKm / 110;
            const longitudeDelta = Math.min(180, latitudeDelta / Math.max(0.001, Math.cos(lat * Math.PI / 180)));
            const stops = repository.stopsInBounds({
                west: lon - longitudeDelta, east: lon + longitudeDelta,
                south: lat - latitudeDelta, north: lat + latitudeDelta,
            });
            return findWithinRadius({ gtfs: { ...gtfs, stops }, sharedMobility: null }, { lat, lon, label: 'Autour de moi' }, radiusKm).stop;
        },
    };
}
export type TransportService = ReturnType<typeof createTransportService>;
