// Le GTFS horaire TCL ne contient pas de shapes. Les tracés SYTRAL normalisés
// complètent l'affichage seulement si la ligne, les quais et leur ordre concordent.
import type { GeoPoint, GtfsRoute } from '../../../../src/types.ts';
import type { MotisLeg } from './client.ts';

type Projection = { position: number; distance: number; point: GeoPoint };
const MAX_PLATFORM_DISTANCE_METERS = 60;

function projectSegment(point: MotisLeg['from'], a: [number, number], b: [number, number], index: number): Projection {
    const scale = Math.cos(point.lat * Math.PI / 180);
    const dx = (b[0] - a[0]) * scale;
    const dy = b[1] - a[1];
    const span = dx * dx + dy * dy;
    const fraction = span === 0 ? 0 : Math.max(0, Math.min(1, (((point.lon - a[0]) * scale * dx) + (point.lat - a[1]) * dy) / span));
    const lon = a[0] + fraction * (b[0] - a[0]);
    const lat = a[1] + fraction * (b[1] - a[1]);
    return { position: index + fraction, distance: Math.hypot((point.lon - lon) * scale, point.lat - lat) * 111320, point: { lat, lon, label: point.name } };
}

function projectStop(point: MotisLeg['from'], shape: GtfsRoute['shape']): Projection | null {
    let closest: Projection | null = null;
    for (let index = 0; index < shape.length - 1; index++) {
        const candidate = projectSegment(point, shape[index], shape[index + 1], index);
        if (!closest || candidate.distance < closest.distance) closest = candidate;
    }
    return closest && closest.distance <= MAX_PLATFORM_DISTANCE_METERS ? closest : null;
}

function servedInOrder(route: GtfsRoute, stops: MotisLeg['from'][]): boolean {
    if (!route.stopSequence) return route.route_type !== 3;
    const sequence = route.stopSequence.map(id => id.replace(/^bus-stop:/, ''));
    const indices = stops.map(stop => sequence.indexOf(stop.stopId?.replace(/^tcl_/, '').replace(/^bus-stop:/, '') ?? ''));
    return indices.every((index, order) => index >= 0 && (order === 0 || index > indices[order - 1]));
}

function sliceShape(route: GtfsRoute, stops: MotisLeg['from'][]): GeoPoint[] {
    if (!servedInOrder(route, stops)) return [];
    const matches = stops.map(stop => projectStop(stop, route.shape));
    if (matches.some(match => !match)) return [];
    const projections = matches.filter((match): match is Projection => match !== null);
    const start = projections[0];
    const end = projections[projections.length - 1];
    const direction = Math.sign(end.position - start.position);
    if (!direction || (route.stopSequence && direction < 0)) return [];
    if (!projections.every((match, index) => index === 0 || direction * (match.position - projections[index - 1].position) > 0)) return [];
    const lower = Math.min(start.position, end.position);
    const upper = Math.max(start.position, end.position);
    const middle = route.shape.flatMap(([lon, lat], index) => index > lower && index < upper ? [{ lat, lon, label: 'Tracé SYTRAL' }] : []);
    return [start.point, ...(direction > 0 ? middle : middle.reverse()), end.point];
}

export function transitShape(leg: MotisLeg, routes: GtfsRoute[]): GeoPoint[] {
    const stops = [leg.from, ...(leg.intermediateStops ?? []), leg.to];
    const candidates = routes.filter(route => route.route_short_name === leg.routeShortName && route.route_type === (leg.mode === 'BUS' ? 3 : leg.routeType));
    const paths = candidates.map(route => sliceShape(route, stops)).filter(path => path.length >= 2);
    // Plusieurs variantes admissibles ne permettent pas d'affirmer laquelle est empruntée.
    return paths.length === 1 ? paths[0] : [];
}
