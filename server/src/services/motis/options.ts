// Choix et traduction du trajet MOTIS retenu.
//
// MOTIS rend des trajets non dominés ; UrbanFlow n'en propose qu'un, celui qui
// arrive le premier avec les moyens demandés, attentes comprises. Ses mesures,
// tracés et lignes viennent tels quels de MOTIS ; seuls les libellés sont ici.
import type { AvailableMode, GeoPoint, MobilityMode, RouteLeg, RouteOption } from '../../../../src/types.ts';
import { ROAD_EMISSION_FACTORS, transitEmissionFactor } from '../../../../src/lib/planner/emissions.ts';
import { haversineDistanceKm } from '../../../../src/lib/planner/geo.ts';
import { lineLabel } from '../../../../src/lib/planner/labels.ts';
import { buildOption } from '../../../../src/lib/planner/legs.ts';
import { round } from '../../../../src/lib/planner/metrics.ts';
import { AVAILABLE_MODE_LABELS } from '../../../../src/lib/planner/search-filters.ts';
import type { MotisItinerary, MotisLeg } from './client.ts';
import { decodePolyline } from './polyline.ts';

const STREET_MODES = new Set(['WALK', 'BIKE', 'RENTAL', 'CAR', 'HGV', 'CAR_PARKING', 'CAR_DROPOFF', 'ODM', 'RIDE_SHARING', 'FLEX']);

/** Mode UrbanFlow d'un segment, `null` pour un mode que l'application ne propose pas. */
function legMode(leg: MotisLeg): MobilityMode | null {
    if (leg.mode === 'WALK') return 'walk';
    if (leg.mode === 'RENTAL') return leg.rental?.formFactor?.startsWith('SCOOTER') ? 'scooter' : 'bike';
    if (leg.mode === 'BIKE') return 'bike';
    return STREET_MODES.has(leg.mode) ? null : 'transit';
}

export interface SearchEnds {
    origin: GeoPoint;
    destination: GeoPoint;
    accessibilityNeed: boolean;
    departureAt: string;
}

/** MOTIS nomme START et END les extrémités saisies ; un engin en libre-service peut n'avoir aucun nom. */
function placePoint(place: MotisLeg['from'], ends: SearchEnds, fallback: string): GeoPoint {
    const label = place.name === 'START' ? ends.origin.label : place.name === 'END' ? ends.destination.label : place.name;
    return { lat: place.lat, lon: place.lon, label: label || fallback };
}

function pathOf(leg: MotisLeg, from: GeoPoint, to: GeoPoint): GeoPoint[] {
    const coordinates = decodePolyline(leg.legGeometry.points, leg.legGeometry.precision);
    return coordinates.map(([lat, lon], index) => ({
        lat, lon, label: index === 0 ? from.label : index === coordinates.length - 1 ? to.label : 'Tracé',
    }));
}

function pathLengthMeters(path: GeoPoint[]): number {
    return path.reduce((total, point, index) => index === 0 ? 0 : total + haversineDistanceKm(path[index - 1], point) * 1000, 0);
}

type LegText = Pick<RouteLeg, 'title' | 'detail' | 'mapLabel' | 'mapColor'>;

function describeTransit(leg: MotisLeg, to: GeoPoint): LegText {
    const label = lineLabel(leg.routeType ?? -1, leg.routeShortName ?? '');
    return {
        title: `${label} vers ${to.label}`,
        detail: leg.headsign ? `${label} direction ${leg.headsign}.` : `${label}.`,
        mapLabel: label,
        mapColor: leg.routeColor ? `#${leg.routeColor}` : undefined,
    };
}

function describeWalk(transfer: boolean, to: GeoPoint, distanceKm: number): LegText {
    return transfer
        ? { title: 'Correspondance à pied', detail: `Correspondance vers ${to.label}.` }
        : { title: `À pied vers ${to.label}`, detail: `Marche sur ${distanceKm.toFixed(2)} km.` };
}

function describeRental(leg: MotisLeg, mode: 'bike' | 'scooter'): LegText {
    const vehicle = mode === 'bike' ? 'Vélo' : 'Trottinette';
    const dropoff = leg.rental?.toStationName ? `dépose à ${leg.rental.toStationName}` : 'dépose libre à l’arrivée';
    return {
        title: `${vehicle} ${leg.rental?.systemName ?? 'partagé'}`,
        detail: `Prise à ${leg.rental?.fromStationName ?? leg.from.name}, ${dropoff}.`,
    };
}

function describe(leg: MotisLeg, mode: MobilityMode, transfer: boolean, to: GeoPoint, distanceKm: number): LegText {
    if (mode === 'transit') return describeTransit(leg, to);
    if (mode === 'walk') return describeWalk(transfer, to, distanceKm);
    return describeRental(leg, mode);
}

function carbonFactor(leg: MotisLeg, mode: MobilityMode): number {
    return mode === 'transit'
        ? transitEmissionFactor(leg.routeType ?? -1).gramsCo2ePerPassengerKm
        : ROAD_EMISSION_FACTORS[mode].gramsCo2ePerPassengerKm;
}

/** La marche est toujours accessible ; le transport doit le publier ; les engins partagés ne sont pas accessibles en fauteuil. */
function accessibleLeg(leg: MotisLeg, mode: MobilityMode): boolean {
    if (mode === 'walk') return true;
    if (mode === 'transit') return leg.wheelchairAccessible === 'ACCESSIBLE';
    return false;
}

function fallbackLabels(mode: MobilityMode): { from: string; to: string } {
    return mode === 'bike' || mode === 'scooter'
        ? { from: 'Point de prise', to: 'Point de dépose' }
        : { from: 'Point de passage', to: 'Point de passage' };
}

function toLeg(leg: MotisLeg, mode: MobilityMode, id: string, ends: SearchEnds): RouteLeg {
    const fallback = fallbackLabels(mode);
    const from = placePoint(leg.from, ends, fallback.from);
    const to = placePoint(leg.to, ends, fallback.to);
    const path = pathOf(leg, from, to);
    const distanceKm = round((leg.distance ?? pathLengthMeters(path)) / 1000, 2);
    const transfer = mode === 'walk' && Boolean(leg.from.stopId && leg.to.stopId);
    const carbonGramsPerKm = carbonFactor(leg, mode);
    return {
        id,
        mode,
        ...(transfer ? { transfer } : {}),
        ...describe(leg, mode, transfer, to, distanceKm),
        from: from.label,
        to: to.label,
        fromPoint: from,
        toPoint: to,
        path,
        distanceKm,
        durationMinutes: Math.max(1, Math.round(leg.duration / 60)),
        carbonGrams: Math.round(distanceKm * carbonGramsPerKm),
        accessible: accessibleLeg(leg, mode),
        estimate: { travelFactor: 1, overheadMinutes: 0, carbonGramsPerKm },
    };
}

/** Suite des moyens empruntés, la marche exclue et les répétitions fondues : vélo, transport, trottinette. */
function modeSequence(legs: RouteLeg[]): AvailableMode[] {
    return legs.reduce<AvailableMode[]>((sequence, leg) => {
        const mode = leg.mode;
        return mode === 'walk' || sequence.at(-1) === mode ? sequence : [...sequence, mode];
    }, []);
}

function transfersLabel(transfers: number): string {
    return transfers === 0 ? 'sans correspondance' : transfers === 1 ? '1 correspondance' : `${transfers} correspondances`;
}

/** « Vélo Vélov jusqu’à Bellecour, puis Métro D puis Tram T1, 1 correspondance, puis Trottinette Dott jusqu’à Part-Dieu. » */
function summaryOf(legs: RouteLeg[], transfers: number): string {
    const transit = legs.filter((leg) => leg.mode === 'transit');
    const rentals = legs.filter((leg) => leg.mode === 'bike' || leg.mode === 'scooter');
    if (transit.length === 0) {
        const rental = rentals[0];
        return rental ? `${rental.title} de ${rental.from} à ${rental.to}.` : 'Itinéraire piéton direct, zéro émission.';
    }
    const lines = transit.map((leg) => leg.mapLabel).join(' puis ');
    const access = rentals.find((leg) => legs.indexOf(leg) < legs.indexOf(transit[0]));
    const egress = rentals.find((leg) => legs.indexOf(leg) > legs.indexOf(transit[transit.length - 1]));
    const before = access ? `${access.title} jusqu’à ${access.to}, puis ` : '';
    const after = egress ? `, puis ${egress.title} jusqu’à ${egress.to}` : '';
    return `${before}${lines}, ${transfersLabel(transfers)}${after}.`;
}

/** Un itinéraire dont tous les segments sont des modes que l'application propose. */
function supported(itinerary: MotisItinerary): boolean {
    return itinerary.legs.every((leg) => legMode(leg) !== null);
}

/**
 * Le trajet qui arrive le premier ; à arrivée égale, le plus court. L'attente
 * avant de partir compte donc, ce qui est le sens d'une recherche « maintenant ».
 */
export function fastestItinerary(itineraries: MotisItinerary[]): MotisItinerary | null {
    return itineraries.filter(supported).reduce<MotisItinerary | null>((best, candidate) => {
        if (!best) return candidate;
        const arrival = Date.parse(candidate.endTime) - Date.parse(best.endTime);
        return arrival < 0 || (arrival === 0 && candidate.duration < best.duration) ? candidate : best;
    }, null);
}

export function toRouteOption(itinerary: MotisItinerary, ends: SearchEnds): RouteOption {
    const legs = itinerary.legs.flatMap((leg, index) => {
        const mode = legMode(leg);
        return mode ? [toLeg(leg, mode, `leg-${index}`, ends)] : [];
    });
    const sequence = modeSequence(legs);
    // L'identifiant nomme la forme du trajet : un enregistrement « Vélo’v puis
    // transport » entre deux mêmes lieux reste le même enregistrement.
    const id = sequence.join('-') || 'walk';
    return buildOption({
        id,
        title: sequence.map((mode) => AVAILABLE_MODE_LABELS[mode]).join(' + ') || 'À pied',
        summary: summaryOf(legs, itinerary.transfers),
        modes: [...new Set(legs.map((leg) => leg.mode))],
        legs: legs.map((leg) => ({ ...leg, id: `${id}-${leg.id}` })),
        departureAt: itinerary.startTime,
        arrivalAt: itinerary.endTime,
        durationMinutes: Math.max(1, Math.ceil((Date.parse(itinerary.endTime) - Date.parse(ends.departureAt)) / 60_000)),
    });
}
