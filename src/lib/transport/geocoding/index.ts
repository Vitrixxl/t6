// Recherche de lieux : les deux sources sont interrogees en parallèle et
// fusionnees. Si l'une tombe, l'autre suffit ; l'erreur n'est propagée que si
// les deux echouent.
import type { GeoPoint } from '../../../types';
import { SEARCH_CENTER } from './area';
import { searchBan } from './ban';
import { searchPhoton } from './photon';
import type { PlaceSearchResult } from './types';

function mergePlaceResults(places: PlaceSearchResult[], addresses: PlaceSearchResult[]): PlaceSearchResult[] {
    const named = places.filter((place) => ['Quartier', 'Gare', 'Ville', 'Lieu'].includes(place.kind));
    const rest = places.filter((place) => !named.includes(place));
    const merged: PlaceSearchResult[] = [];

    for (const candidate of [...named, ...addresses, ...rest]) {
        const duplicate = merged.some(
            (item) =>
                item.label.toLowerCase() === candidate.label.toLowerCase() &&
                Math.abs(item.lat - candidate.lat) < 0.0015 &&
                Math.abs(item.lon - candidate.lon) < 0.0015,
        );
        if (!duplicate) {
            merged.push(candidate);
        }
    }

    return merged.slice(0, 8);
}

export async function searchPlaces(query: string, origin?: GeoPoint, signal?: AbortSignal): Promise<PlaceSearchResult[]> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
        return [];
    }

    const proximity = origin ?? SEARCH_CENTER;
    const [banOutcome, photonOutcome] = await Promise.allSettled([
        searchBan(trimmedQuery, proximity, signal),
        searchPhoton(trimmedQuery, proximity, signal),
    ]);

    if (banOutcome.status === 'rejected' && photonOutcome.status === 'rejected') {
        throw banOutcome.reason instanceof Error ? banOutcome.reason : new Error('Recherche indisponible');
    }

    return mergePlaceResults(
        photonOutcome.status === 'fulfilled' ? photonOutcome.value : [],
        banOutcome.status === 'fulfilled' ? banOutcome.value : [],
    );
}

export { describePoint } from './reverse';
export type { PlaceKind, PlaceSearchResult } from './types';
