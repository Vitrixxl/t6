// Traduction des itinéraires MOTIS en options UrbanFlow.
//
// MOTIS rend des trajets non dominés, sans notion de famille. UrbanFlow en
// garde une lecture par famille (transport, vélo + transport, ...) parce que
// c'est ainsi que l'interface compare et présélectionne. La famille se déduit
// des segments ; les mesures, tracés et lignes viennent tels quels de MOTIS.
import type { GeoPoint, MobilityMode, MobilityProfile, RouteLeg, RouteOption } from '../../../../src/types.ts';
import { ROAD_EMISSION_FACTORS, transitEmissionFactor } from '../../../../src/lib/planner/emissions.ts';
import { haversineDistanceKm } from '../../../../src/lib/planner/geo.ts';
import { lineLabel } from '../../../../src/lib/planner/labels.ts';
import { buildOption } from '../../../../src/lib/planner/legs.ts';
import { round } from '../../../../src/lib/planner/metrics.ts';
import type { MotisItinerary, MotisLeg } from './client.ts';
import { decodePolyline } from './polyline.ts';

export type Family = 'transit' | 'bike-transit' | 'scooter-transit' | 'bike' | 'scooter' | 'walk';

const FAMILIES: Record<Family, { title: string; reliabilityScore: number }> = {
    transit: { title: 'Transport en commun', reliabilityScore: 88 },
    'bike-transit': { title: 'Vélo + transport en commun', reliabilityScore: 90 },
    'scooter-transit': { title: 'Trottinette + transport en commun', reliabilityScore: 84 },
    bike: { title: 'Vélo', reliabilityScore: 86 },
    scooter: { title: 'Trottinette', reliabilityScore: 80 },
    walk: { title: 'À pied', reliabilityScore: 92 },
};

/** Variantes de transport proposées pour un même trajet : des lignes différentes. */
const TRANSIT_VARIANTS = 3;

const STREET_MODES = new Set(['WALK', 'BIKE', 'RENTAL', 'CAR', 'HGV', 'CAR_PARKING', 'CAR_DROPOFF', 'ODM', 'RIDE_SHARING', 'FLEX']);

/** Mode UrbanFlow d'un segment, `null` pour un mode que l'application ne propose pas. */
function legMode(leg: MotisLeg): MobilityMode | null {
    if (leg.mode === 'WALK') return 'walk';
    if (leg.mode === 'RENTAL') return leg.rental?.formFactor?.startsWith('SCOOTER') ? 'scooter' : 'bike';
    if (leg.mode === 'BIKE') return 'bike';
    return STREET_MODES.has(leg.mode) ? null : 'transit';
}

function familyOf(modes: MobilityMode[]): Family {
    const transit = modes.includes('transit');
    if (modes.includes('bike')) return transit ? 'bike-transit' : 'bike';
    if (modes.includes('scooter')) return transit ? 'scooter-transit' : 'scooter';
    return transit ? 'transit' : 'walk';
}

interface SearchEnds {
    origin: GeoPoint;
    destination: GeoPoint;
    profile: MobilityProfile;
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

/** La marche est toujours accessible ; le transport doit le publier ; un engin dépend du profil. */
function accessibleLeg(leg: MotisLeg, mode: MobilityMode, profile: MobilityProfile): boolean {
    if (mode === 'walk') return true;
    if (mode === 'transit') return leg.wheelchairAccessible === 'ACCESSIBLE';
    return !profile.accessibilityNeed;
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
        accessible: accessibleLeg(leg, mode, ends.profile),
        estimate: { travelFactor: 1, overheadMinutes: 0, carbonGramsPerKm },
    };
}

function summaryOf(legs: RouteLeg[], transfers: number): string {
    const lines = legs.filter((leg) => leg.mode === 'transit').map((leg) => leg.mapLabel).join(' puis ');
    const feeder = legs.find((leg) => leg.mode === 'bike' || leg.mode === 'scooter');
    if (!lines) {
        return feeder ? `${feeder.title} de ${feeder.from} à ${feeder.to}.` : 'Itinéraire piéton direct, zéro émission.';
    }
    const correspondances = transfers === 0 ? 'sans correspondance' : transfers === 1 ? '1 correspondance' : `${transfers} correspondances`;
    return feeder ? `${feeder.title} jusqu’à ${feeder.to}, puis ${lines}, ${correspondances}.` : `${lines}, ${correspondances}.`;
}

function toRouteOption(itinerary: MotisItinerary, family: Family, index: number, ends: SearchEnds): RouteOption {
    const id = `${family}-${index}`;
    const legs = itinerary.legs.flatMap((leg, legIndex) => {
        const mode = legMode(leg);
        return mode ? [toLeg(leg, mode, `${id}-${legIndex}`, ends)] : [];
    });
    const modes = [...new Set(legs.map((leg) => leg.mode))];
    const option = buildOption({
        id,
        title: FAMILIES[family].title,
        summary: summaryOf(legs, itinerary.transfers),
        modes,
        legs,
        reliabilityScore: FAMILIES[family].reliabilityScore,
        warnings: [],
    });
    // La durée MOTIS comprend les attentes à quai, absentes des segments.
    return { ...option, durationMinutes: Math.max(1, Math.round(itinerary.duration / 60)) };
}

function linesKey(itinerary: MotisItinerary): string {
    return itinerary.legs.map((leg) => leg.routeShortName ?? '').filter(Boolean).join('>');
}

/**
 * Regroupe les itinéraires par famille : la plus rapide de chaque famille, et
 * jusqu'à trois variantes de transport qui n'empruntent pas les mêmes lignes.
 */
export function selectOptions(itineraries: MotisItinerary[], ends: SearchEnds): RouteOption[] {
    const byFamily = new Map<Family, MotisItinerary[]>();
    for (const itinerary of itineraries) {
        const modes = itinerary.legs.map(legMode);
        if (modes.some((mode) => mode === null)) continue;
        const family = familyOf(modes as MobilityMode[]);
        byFamily.set(family, [...(byFamily.get(family) ?? []), itinerary]);
    }
    return [...byFamily.entries()].flatMap(([family, candidates]) => {
        const sorted = [...candidates].sort((a, b) => a.duration - b.duration);
        const seen = new Set<string>();
        const kept = family === 'transit'
            ? sorted.filter((itinerary) => !seen.has(linesKey(itinerary)) && seen.add(linesKey(itinerary)).size > 0).slice(0, TRANSIT_VARIANTS)
            : sorted.slice(0, 1);
        return kept.map((itinerary, index) => toRouteOption(itinerary, family, index, ends));
    });
}
