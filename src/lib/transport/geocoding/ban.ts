// Base Adresse Nationale : geocodage des adresses postales.
import type { GeoPoint } from '../../../types';
import { withTimeout } from '../http';
import { SEARCH_DEPARTMENT } from './area';
import type { AdresseResponse, PlaceKind, PlaceSearchResult } from './types';

export function banKind(type: string | undefined): PlaceKind {
  if (type === 'housenumber') return 'Adresse';
  if (type === 'street') return 'Rue';
  if (type === 'locality') return 'Quartier';
  if (type === 'municipality') return 'Ville';
  return 'Adresse';
}

export async function searchBan(query: string, proximity: Pick<GeoPoint, 'lat' | 'lon'>, signal?: AbortSignal): Promise<PlaceSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: '6',
    autocomplete: '1',
    lat: String(proximity.lat),
    lon: String(proximity.lon),
  });

  const response = await fetch(`https://api-adresse.data.gouv.fr/search/?${params.toString()}`, {
    signal: withTimeout(signal),
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Recherche adresse indisponible (${response.status})`);
  }

  const payload = (await response.json()) as AdresseResponse;
  return payload.features
    .filter((feature) => (feature.properties.context ?? '').trim().startsWith(SEARCH_DEPARTMENT))
    .map((feature, index) => ({
      id: feature.properties.id ?? `${feature.properties.label}-${index}`,
      label: feature.properties.label,
      context: feature.properties.context ?? '',
      kind: banKind(feature.properties.type),
      lon: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      source: 'api-adresse' as const,
    }));
}
