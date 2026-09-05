import type {
    ScheduledJourney, ScheduledRide, TimetableTrip, TransitJourneyResult, TransitSearch,
} from '../../../../src/contracts/transit';
import { calendarDate } from '../../../../src/lib/trips/calendar';
import type { TransitRepository } from '../../repositories/transit';
import { serviceDays, serviceStart } from './time';

type Feed = NonNullable<ReturnType<TransitRepository['active']>>;
type Access = TransitSearch['departures'][number];
type RawRide = Omit<ScheduledRide, 'path'> & { shapeId: string; fromIndex: number; toIndex: number };
interface Arrival {
    rides: RawRide[];
    at: number;
    access: Access;
}
interface Boarding extends Arrival {
    transferSeconds: number;
    transferEstimated: boolean;
}

function initialBoardings(search: TransitSearch): Map<string, Boarding> {
    return new Map(search.departures.map((access) => [access.stopId, {
        rides: [], at: Date.parse(search.departureAt) + access.durationSeconds * 1000,
        access, transferSeconds: 0, transferEstimated: false,
    }]));
}

function addEarlier<T extends Arrival>(map: Map<string, T>, id: string, candidate: T): void {
    const previous = map.get(id);
    if (!previous || candidate.at < previous.at) map.set(id, candidate);
}

function rideFromPassages(
    feed: Feed, trip: TimetableTrip, board: TimetableTrip['passages'][number],
    alight: TimetableTrip['passages'][number], start: number, source: Boarding,
): RawRide | null {
    const boarding = feed.network.stops.find((stop) => stop.stop_id === board.stopId);
    const alighting = feed.network.stops.find((stop) => stop.stop_id === alight.stopId);
    if (!boarding || !alighting) return null;
    return {
        tripId: trip.id, routeId: trip.routeId, shapeId: trip.shapeId, headsign: trip.headsign,
        fromIndex: board.shapeIndex, toIndex: alight.shapeIndex,
        boarding, alighting, readyAt: new Date(source.at).toISOString(),
        departureAt: new Date(start + board.departure * 1000).toISOString(),
        arrivalAt: new Date(start + alight.arrival * 1000).toISOString(),
        transferSeconds: source.transferSeconds, transferEstimated: source.transferEstimated,
        timing: trip.frequency && !trip.frequency.exact ? 'frequency' : 'scheduled',
    };
}

function alightings(
    feed: Feed, trip: TimetableTrip, boardIndex: number, start: number, source: Boarding,
    result: Map<string, Arrival>, accessible: boolean,
): void {
    const board = trip.passages[boardIndex];
    for (const alight of trip.passages.slice(boardIndex + 1).filter((passage) => passage.dropoff)) {
        const ride = rideFromPassages(feed, trip, board, alight, start, source);
        if (!ride || (accessible && (ride.alighting.wheelchair_boarding !== 1 || ride.boarding.wheelchair_boarding !== 1))) continue;
        addEarlier(result, alight.stopId, { rides: [...source.rides, ride], at: Date.parse(ride.arrivalAt), access: source.access });
    }
}

function scanTrip(
    feed: Feed, trip: TimetableTrip, start: number, boardings: Map<string, Boarding>,
    result: Map<string, Arrival>, accessible: boolean,
): void {
    if (accessible && !trip.accessible) return;
    for (const [index, passage] of trip.passages.entries()) {
        const source = boardings.get(passage.stopId);
        if (!source || !passage.pickup) continue;
        if (source.rides.some((ride) => ride.tripId === trip.id)) continue;
        const shiftedStart = tripStart(trip, passage, start, source.at);
        if (shiftedStart === null || shiftedStart + passage.departure * 1000 < source.at) continue;
        alightings(feed, trip, index, shiftedStart, source, result, accessible);
    }
}

function tripStart(trip: TimetableTrip, passage: TimetableTrip['passages'][number], start: number, readyAt: number): number | null {
    const frequency = trip.frequency;
    if (!frequency) return start;
    const offset = passage.departure - trip.passages[0].departure;
    const ready = Math.max(frequency.start, (readyAt - start) / 1000 - offset);
    const departure = frequency.exact
        ? frequency.start + Math.ceil((ready - frequency.start) / frequency.headway) * frequency.headway
        : ready + frequency.headway / 2;
    if (departure >= frequency.end) return null;
    return start + (departure - trip.passages[0].departure) * 1000;
}

function scanRound(repository: TransitRepository, feed: Feed, boardings: Map<string, Boarding>, search: TransitSearch): Map<string, Arrival> {
    const result = new Map<string, Arrival>();
    if (boardings.size === 0) return result;
    const after = Math.min(...Array.from(boardings.values(), (source) => source.at));
    for (const day of serviceDays(Date.parse(search.departureAt), feed.metadata)) {
        const start = serviceStart(day, feed.metadata.timeZone);
        const trips = repository.departures(feed.id, day, [...boardings.keys()], Math.max(0, (after - start) / 1000), feed.metadata.maxTimeSeconds);
        for (const trip of trips) scanTrip(feed, trip, start, boardings, result, search.requireAccessible);
    }
    return result;
}

function transferDetails(feed: Feed, fromStopId: string, toStopId: string) {
    const rule = feed.transfers.find((item) => item.fromStopId === fromStopId && item.toStopId === toStopId);
    if (rule?.forbidden) return null;
    return { transferSeconds: rule?.minimumSeconds ?? 240, transferEstimated: rule?.estimated ?? true };
}

function transferBoardings(feed: Feed, arrivals: Map<string, Arrival>, accessible: boolean): Map<string, Boarding> {
    const result = new Map<string, Boarding>();
    for (const [stopId, source] of arrivals) {
        const from = feed.network.stops.find((stop) => stop.stop_id === stopId);
        if (!from) continue;
        const targets = feed.network.stops.filter((to) =>
            to.stop_id === stopId || (from.parent_station !== '' && to.parent_station === from.parent_station)
            || feed.transfers.some((rule) => rule.fromStopId === stopId && rule.toStopId === to.stop_id),
        );
        for (const to of targets) {
            const transfer = transferDetails(feed, stopId, to.stop_id);
            if (!transfer || (accessible && to.wheelchair_boarding !== 1)) continue;
            addEarlier(result, to.stop_id, {
                ...source, ...transfer, at: source.at + transfer.transferSeconds * 1000,
            });
        }
    }
    return result;
}

function resolveGeometry(repository: TransitRepository, feed: Feed, rides: RawRide[]): ScheduledRide[] | null {
    const result: ScheduledRide[] = [];
    for (const { shapeId, fromIndex, toIndex, ...ride } of rides) {
        const shape = repository.shape(feed.id, shapeId);
        if (!shape || toIndex <= fromIndex || toIndex >= shape.length) return null;
        const path = shape.slice(fromIndex, toIndex + 1).map(([lon, lat]) => ({ lon, lat, label: ride.headsign || ride.alighting.stop_name }));
        result.push({ ...ride, path });
    }
    return result;
}

function bestJourney(repository: TransitRepository, feed: Feed, search: TransitSearch, rounds: Map<string, Arrival>[]): ScheduledJourney | null {
    const candidates = rounds.flatMap((round) => search.arrivals.flatMap((access) => {
        const source = round.get(access.stopId);
        return source ? [{ source, access, arrival: source.at + access.durationSeconds * 1000 }] : [];
    })).sort((a, b) => a.arrival - b.arrival);
    for (const candidate of candidates) {
        const rides = resolveGeometry(repository, feed, candidate.source.rides);
        if (!rides) continue;
        return {
            rides, departureAccess: candidate.source.access, arrivalAccess: candidate.access,
            arrivalAt: new Date(candidate.arrival).toISOString(),
            durationSeconds: (candidate.arrival - Date.parse(search.departureAt)) / 1000,
        };
    }
    return null;
}

export function searchTimetable(repository: TransitRepository, search: TransitSearch): TransitJourneyResult {
    const feed = repository.active();
    if (!feed) return { status: 'unavailable', metadata: null, journey: null };
    const date = calendarDate(new Date(search.departureAt), feed.metadata.timeZone);
    if (date < feed.metadata.startDate || serviceDays(Date.parse(search.departureAt), feed.metadata).length === 0) {
        return { status: 'outside-coverage', metadata: feed.metadata, journey: null };
    }
    const first = scanRound(repository, feed, initialBoardings(search), search);
    const second = scanRound(repository, feed, transferBoardings(feed, first, search.requireAccessible), search);
    const journey = bestJourney(repository, feed, search, [first, second]);
    return { status: journey ? 'ready' : 'no-service', metadata: feed.metadata, journey };
}
