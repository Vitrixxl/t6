// Forme minimale des collections GeoJSON servies aux sources MapLibre : on ne
// décrit que ce que la carte consomme réellement, plutôt que d'embarquer une
// dépendance de types GeoJSON complète.

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
