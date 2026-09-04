// Integration des flux transport : geocodage, routage et sources de donnees.
// Le reste de l'application importe d'ici et ignore le decoupage interne.
export { describePoint, searchPlaces, type PlaceKind, type PlaceSearchResult } from './geocoding';
export { enhanceLegsWithLiveRouting, fetchRouteMatrix, hasCompleteGeometry } from './routing';
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
