// Chargement du réseau de transport : GTFS statique du build, puis
// enrichissements live. Chaque source est tentee indépendamment et retombe sur
// le feed local en cas d'échec, de sorte qu'une source indisponible ne prive
// jamais l'utilisateur des autres. L'origine réelle de chaque flux est
// remontée dans `sources` et affichée dans l'interface.
import type { GtfsFeed, NetworkSources, SharedMobilityFeed, TransportNetwork } from '../../../types';
import { fetchJson } from './fetch-json';
import { fetchLiveSharedMobility } from './gbfs';
import { OPEN_METEO_URL, weatherFromOpenMeteo, type OpenMeteoCurrent } from './weather';

export async function loadTransportNetwork(fetcher: typeof fetch = fetch): Promise<TransportNetwork> {
    const gtfs = await fetchJson<GtfsFeed>('/data/gtfs-feed.json', fetcher);
    const sources: NetworkSources = {
        gtfs: gtfs.agency.agency_id === 'ufm-metropole' ? 'local' : 'tcl-odbl',
        sharedMobility: 'local',
        weather: 'local',
    };

    let sharedMobility: SharedMobilityFeed;
    try {
        sharedMobility = await fetchLiveSharedMobility(fetcher);
        sources.sharedMobility = 'gbfs-live';
    } catch {
        sharedMobility = await fetchJson<SharedMobilityFeed>('/data/shared-mobility.json', fetcher);
    }

    try {
        const meteo = await fetchJson<{ current: OpenMeteoCurrent }>(OPEN_METEO_URL, fetcher);
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
