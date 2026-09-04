// Photon (OpenStreetMap) : quartiers, gares et lieux nommes, que la BAN ne
// couvre pas.
import type { GeoPoint } from '../../../types';
import { withTimeout } from '../http';
import { inMetroBbox, METRO_BBOX } from './area';
import type { PhotonFeature, PhotonResponse, PlaceKind, PlaceSearchResult } from './types';

export function photonKind(properties: PhotonFeature['properties']): PlaceKind {
    const osmValue = properties.osm_value ?? '';
    if (properties.osm_key === 'railway' || osmValue === 'station' || osmValue === 'halt') return 'Gare';
    if (properties.type === 'district' || ['suburb', 'neighbourhood', 'quarter', 'borough'].includes(osmValue)) return 'Quartier';
    if (properties.type === 'city' || ['city', 'town', 'village'].includes(osmValue)) return 'Ville';
    if (properties.type === 'street') return 'Rue';
    if (properties.type === 'house') return 'Adresse';
    return 'Lieu';
}

export async function searchPhoton(query: string, proximity: Pick<GeoPoint, 'lat' | 'lon'>, signal?: AbortSignal): Promise<PlaceSearchResult[]> {
    const params = new URLSearchParams({
        q: query,
        limit: '6',
        lang: 'fr',
        lat: String(proximity.lat),
        lon: String(proximity.lon),
        bbox: `${METRO_BBOX.minLon},${METRO_BBOX.minLat},${METRO_BBOX.maxLon},${METRO_BBOX.maxLat}`,
    });

    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
        signal: withTimeout(signal),
        headers: {
            Accept: 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Recherche de lieux indisponible (${response.status})`);
    }

    const payload = (await response.json()) as PhotonResponse;
    return payload.features
        .filter((feature) => {
            const [lon, lat] = feature.geometry.coordinates;
            const country = feature.properties.countrycode ?? 'FR';
            return Boolean(feature.properties.name) && country === 'FR' && inMetroBbox(lon, lat);
        })
        .map((feature, index) => {
            const properties = feature.properties;
            const contextParts = [properties.district, properties.city, properties.postcode].filter(
                (part, partIndex, parts) => part && parts.indexOf(part) === partIndex && part !== properties.name,
            );
            return {
                id: properties.osm_id ? `osm-${properties.osm_id}` : `photon-${properties.name}-${index}`,
                label: properties.name ?? '',
                context: contextParts.join(', '),
                kind: photonKind(properties),
                lon: feature.geometry.coordinates[0],
                lat: feature.geometry.coordinates[1],
                source: 'photon' as const,
            };
        });
}

// Fusion: les lieux nommes (quartiers, gares, villes) d'abord - c'est ce qu'on
// tape le plus souvent ("part dieu") - puis les rues et adresses de la BAN.
// Dedoublonnage grossier par nom + ~150 m.
