// Décodage des tracés MOTIS, encodés au format « Google encoded polyline » :
// chaque coordonnée est un écart signé par rapport à la précédente, écrit en
// base 32 sur des caractères ASCII imprimables. La précision (5, 6 ou 7
// décimales) est annoncée par MOTIS avec chaque tracé.

function readDelta(points: string, cursor: { index: number }): number {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
        byte = points.charCodeAt(cursor.index) - 63;
        cursor.index += 1;
        result |= (byte & 0x1f) << shift;
        shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
}

/** Rend des couples `[lat, lon]` en degrés. */
export function decodePolyline(points: string, precision: number): Array<[number, number]> {
    const factor = 10 ** precision;
    const cursor = { index: 0 };
    let lat = 0;
    let lon = 0;
    const coordinates: Array<[number, number]> = [];
    while (cursor.index < points.length) {
        lat += readDelta(points, cursor);
        lon += readDelta(points, cursor);
        coordinates.push([lat / factor, lon / factor]);
    }
    return coordinates;
}
