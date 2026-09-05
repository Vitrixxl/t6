// Les disponibilités partagées exigent une réponse en direct. Une panne ne
// doit pas alimenter la carte et les itinéraires avec des données anciennes.
import type { GtfsFeed, NetworkSources, SharedMobilityFeed, TransportNetwork } from '../../../types';
import { fetchLiveSharedMobility } from './gbfs';

export async function loadTransportNetwork(gtfs: GtfsFeed): Promise<TransportNetwork> {
    const sources: NetworkSources = {
        gtfs: gtfs.agency.agency_id === 'ufm-metropole' ? 'local' : 'tcl-odbl',
    };

    let sharedMobility: SharedMobilityFeed | null;
    try {
        sharedMobility = await fetchLiveSharedMobility();
    } catch {
        sharedMobility = null;
    }

    return { gtfs, sharedMobility, sources };
}

export function getFeedFreshness(feed: SharedMobilityFeed): string {
    const updatedAt = new Date(feed.last_updated * 1000);
    return updatedAt.toLocaleString('fr-FR', {
        dateStyle: 'short',
        timeStyle: 'short',
    });
}

export { CITY_CENTER, METRO_RADIUS_KM } from './area';
export { fetchJson } from './fetch-json';
export { mapDottVehicles, mergeVelovStations } from './gbfs';
