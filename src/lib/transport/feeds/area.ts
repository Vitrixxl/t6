// Périmètre de la métropole desservie : les flux partagés couvrent une zone
// plus large que le service, on ecarte ce qui est hors périmètre.
export const CITY_CENTER = { lat: 45.7578, lon: 4.832 };
export const METRO_RADIUS_KM = 16;
export const STATION_RADIUS_KM = METRO_RADIUS_KM;

export function distanceToCenterKm(lat: number, lon: number): number {
    const earthRadiusKm = 6371;
    const dLat = ((lat - CITY_CENTER.lat) * Math.PI) / 180;
    const dLon = ((lon - CITY_CENTER.lon) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((CITY_CENTER.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
}
