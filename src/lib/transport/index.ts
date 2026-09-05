// Intégration des flux transport : géocodage, routage et sources de données.
// Le reste de l'application importe d'ici et ignore le découpage interne.
export { describePoint, searchPlaces, type PlaceKind, type PlaceSearchResult } from './geocoding';
export { enhanceLegsWithLiveRouting, fetchRouteMatrix } from './routing';
export {
    CITY_CENTER,
    METRO_RADIUS_KM,
    fetchJson,
    getFeedFreshness,
    loadTransportNetwork,
    mapDottVehicles,
    mergeVelovStations,
    weatherFromOpenMeteo,
} from './feeds';
