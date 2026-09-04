// Forme minimale des collections GeoJSON servies aux sources MapLibre : on ne
// decrit que ce que la carte consomme reellement, plutot que d'embarquer une
// dependance de types GeoJSON complete.

export type FeatureCollection = {
    type: 'FeatureCollection';
    features: Array<{
        type: 'Feature';
        properties: Record<string, string | number | boolean | null>;
        geometry:
        | {
            type: 'LineString';
            coordinates: number[][];
        }
        | {
            type: 'Point';
            coordinates: number[];
        };
    }>;
};
