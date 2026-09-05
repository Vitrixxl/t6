// Les disponibilités partagées exigent une réponse en direct. Une panne ne
// doit pas alimenter la carte et les itinéraires avec des données anciennes.
import type { GtfsFeed, NetworkSources, SharedMobilityFeed, TransportNetwork } from '../../../types';
import { fetchJson } from './fetch-json';
import { fetchLiveSharedMobility } from './gbfs';
import { OPEN_METEO_URL, weatherFromOpenMeteo, type OpenMeteoCurrent } from './weather';

export async function loadTransportNetwork(): Promise<TransportNetwork> {
    const gtfs = await fetchJson<GtfsFeed>('/data/gtfs-feed.json');
    const sources: NetworkSources = {
        gtfs: gtfs.agency.agency_id === 'ufm-metropole' ? 'local' : 'tcl-odbl',
        weather: 'local',
    };

    let sharedMobility: SharedMobilityFeed | null;
    try {
        sharedMobility = await fetchLiveSharedMobility();
    } catch {
        sharedMobility = null;
    }

    try {
        const meteo = await fetchJson<{ current: OpenMeteoCurrent }>(OPEN_METEO_URL);
        gtfs.weather = weatherFromOpenMeteo(meteo.current);
        sources.weather = 'open-meteo';
    } catch {
        // Météo locale du feed conservée.
    }

    return {
        gtfs,
        sharedMobility,
        sources,
    };
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
export { weatherFromOpenMeteo } from './weather';
