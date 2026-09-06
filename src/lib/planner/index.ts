// Ce qui reste métier UrbanFlow autour du trajet calculé par MOTIS : les
// filtres d'une recherche, les segments visibles, la référence carbone et les
// outils géographiques. Le choix du trajet, lui, est fait côté serveur.
export { haversineDistanceKm } from './geo';
export { LANDMARKS } from './constants';
export { visibleLegs } from './rules';
export {
    findNearby,
    findWithinRadius,
    formatDistance,
    walkMinutes,
    type Nearby,
    type NearbyWithin,
} from './nearby';
export { applyCarbonReference, createCarbonReference } from './emissions';
export { midpointOfPath } from './shape';
export {
    ALL_TRANSIT_TYPES,
    AVAILABLE_MODE_LABELS,
    TRANSIT_TYPES,
    availableModesOf,
    describeFilters,
    filtersFromProfile,
    type SearchFilters,
    type TransitType,
} from './search-filters';
