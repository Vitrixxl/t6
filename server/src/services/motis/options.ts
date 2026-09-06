// Classement et traduction des trajets MOTIS autorisés.
//
// MOTIS rend des trajets non dominés ; UrbanFlow les propose par arrivée
// croissante avec les moyens demandés, attentes comprises. Les horaires et
// lignes viennent de MOTIS. Les droites du GTFS sans shapes ne sont pas tracées.
import type { AvailableMode, GeoPoint, GtfsRoute, MobilityMode, RouteLeg, RouteOption } from '../../../../src/types.ts';
import { createHash } from 'node:crypto';
import { ROAD_EMISSION_FACTORS, transitEmissionFactor } from '../../../../src/lib/planner/emissions.ts';
import { haversineDistanceKm } from '../../../../src/lib/planner/geo.ts';
import { lineLabel } from '../../../../src/lib/planner/labels.ts';
import { buildOption } from '../../../../src/lib/planner/legs.ts';
import { round } from '../../../../src/lib/planner/metrics.ts';
import { AVAILABLE_MODE_LABELS } from '../../../../src/lib/planner/search-filters.ts';
import { transitTypeOf, type MotisItinerary, type MotisLeg } from './client.ts';
import { boardingWaits } from './timing.ts';
import { transitShape } from './transit-shape.ts';
import { decodePolyline } from './polyline.ts';

const STREET_MODES = new Set(['WALK', 'BIKE', 'RENTAL', 'CAR', 'HGV', 'CAR_PARKING', 'CAR_DROPOFF', 'ODM', 'RIDE_SHARING', 'FLEX']);

/** Mode UrbanFlow d'un segment, `null` pour un mode que l'application ne propose pas. */
function legMode(leg: MotisLeg): MobilityMode | null {
    if (leg.mode === 'WALK') return 'walk';
    if (leg.mode === 'RENTAL') return leg.rental?.formFactor === 'SCOOTER_STANDING' ? 'scooter' : leg.rental?.formFactor === 'BICYCLE' ? 'bike' : null;
    if (leg.mode === 'BIKE') return 'bike';
    return STREET_MODES.has(leg.mode) ? null : 'transit';
}

export interface SearchEnds {
    origin: GeoPoint;
    destination: GeoPoint;
    accessibilityNeed: boolean;
    departureAt: string;
    lineShapes?: GtfsRoute[];
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

function describeTransit(leg: MotisLeg, to: GeoPoint, traced: boolean): LegText {
    const label = lineLabel(transitTypeOf(leg) ?? leg.routeType ?? -1, leg.routeShortName ?? '');
    return {
        title: `${label} vers ${to.label}`,
        detail: `${leg.headsign ? `${label} direction ${leg.headsign}.` : `${label}.`} Horaires théoriques TCL. ${traced ? 'Tracé officiel SYTRAL.' : 'Tracé de ligne indisponible ; distance et bilan carbone estimés entre les arrêts.'}`,
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

function describe(leg: MotisLeg, mode: MobilityMode, transfer: boolean, to: GeoPoint, distanceKm: number, traced: boolean): LegText {
    if (mode === 'transit') return describeTransit(leg, to, traced);
    if (mode === 'walk') return describeWalk(transfer, to, distanceKm);
    return describeRental(leg, mode);
}

function carbonFactor(leg: MotisLeg, mode: MobilityMode): number {
    return mode === 'transit'
        ? transitEmissionFactor(transitTypeOf(leg) ?? leg.routeType ?? -1).gramsCo2ePerPassengerKm
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

function toLeg(leg: MotisLeg, mode: MobilityMode, id: string, ends: SearchEnds, waitingSeconds?: number): RouteLeg {
    const fallback = fallbackLabels(mode);
    const from = placePoint(leg.from, ends, fallback.from);
    const to = placePoint(leg.to, ends, fallback.to);
    const rawPath = pathOf(leg, from, to);
    const path = mode === 'transit' ? transitShape(leg, ends.lineShapes ?? []) : rawPath;
    const meters = mode === 'transit' ? pathLengthMeters(path.length > 1 ? path : rawPath) : leg.distance ?? pathLengthMeters(path);
    const distanceKm = round(meters / 1000, 2);
    const transfer = mode === 'walk' && Boolean(leg.from.stopId && leg.to.stopId);
    const carbonGramsPerKm = carbonFactor(leg, mode);
    return {
        id,
        mode,
        ...(mode === 'transit' ? { transitType: transitTypeOf(leg), lineCode: leg.routeShortName, boardingAt: leg.startTime, waitingSeconds } : {}),
        ...(transfer ? { transfer } : {}),
        ...describe(leg, mode, transfer, to, distanceKm, path.length > 1),
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
export function usableItinerary(itinerary: MotisItinerary): boolean {
    return itinerary.legs.every((leg) => !leg.cancelled && !leg.from.cancelled && !leg.to.cancelled && legMode(leg) !== null);
}

/**
 * Le trajet qui arrive le premier ; à arrivée égale, le plus court. L'attente
 * avant de partir compte donc, ce qui est le sens d'une recherche « maintenant ».
 */
export function fastestItinerary(itineraries: MotisItinerary[]): MotisItinerary | null {
    return itineraries.filter(usableItinerary).reduce<MotisItinerary | null>((best, candidate) => {
        return !best || compareItineraries(candidate, best) < 0 ? candidate : best;
    }, null);
}

export function compareItineraries(left: MotisItinerary, right: MotisItinerary): number {
    return Date.parse(left.endTime) - Date.parse(right.endTime) || left.duration - right.duration;
}

export function toRouteOption(itinerary: MotisItinerary, ends: SearchEnds): RouteOption {
    const waits = boardingWaits(itinerary, ends.departureAt);
    const legs = itinerary.legs.flatMap((leg, index) => {
        const mode = legMode(leg);
        return mode ? [toLeg(leg, mode, `leg-${index}`, ends, waits[index])] : [];
    });
    const sequence = modeSequence(legs);
    // Deux variantes avec les mêmes moyens doivent pouvoir être sélectionnées
    // et enregistrées séparément, sans dépendre de leur position dans la liste.
    const fingerprint = createHash('sha256').update(JSON.stringify(itinerary)).digest('hex');
    const id = `${sequence.join('-') || 'walk'}-${fingerprint}`;
    return buildOption({
        id,
        title: sequence.map((mode) => AVAILABLE_MODE_LABELS[mode]).join(' + ') || 'À pied',
        summary: summaryOf(legs, itinerary.transfers),
        modes: [...new Set(legs.map((leg) => leg.mode))],
        legs: legs.map((leg) => ({ ...leg, id: `${id}-${leg.id}` })),
        departureAt: ends.departureAt,
        arrivalAt: itinerary.endTime,
        durationMinutes: Math.max(1, Math.ceil((Date.parse(itinerary.endTime) - Date.parse(ends.departureAt)) / 60_000)),
    });
}
