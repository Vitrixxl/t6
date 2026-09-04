// Contrats des deux geocodeurs interroges.
import type { GeoPoint } from '../../../types';

/** Nature du lieu, affichee dans les resultats de recherche. */
export type PlaceKind = 'Quartier' | 'Ville' | 'Gare' | 'Rue' | 'Adresse' | 'Lieu';

export interface PlaceSearchResult extends GeoPoint {
    id: string;
    context: string;
    kind: PlaceKind;
    source: 'api-adresse' | 'photon' | 'local';
}

export interface AdresseFeature {
    type: 'Feature';
    properties: {
        id?: string;
        label: string;
        context?: string;
        name?: string;
        type?: string;
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
}

export interface AdresseResponse {
    features: AdresseFeature[];
}

export interface PhotonFeature {
    type: 'Feature';
    properties: {
        osm_id?: number;
        osm_key?: string;
        osm_value?: string;
        type?: string;
        name?: string;
        city?: string;
        district?: string;
        postcode?: string;
        countrycode?: string;
    };
    geometry: {
        type: 'Point';
        coordinates: [number, number];
    };
}

export interface PhotonResponse {
    features: PhotonFeature[];
}
