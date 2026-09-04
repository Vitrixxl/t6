// Selection des points d'acces au reseau par temps de trajet reel.
//
// Haversine ne sert qu'a retenir huit candidats : une barriere urbaine peut
// rendre le point geometriquement le plus proche beaucoup plus long a rejoindre.
// La decision finale repose donc sur une matrice OSRM, puis le planificateur
// pur recoit les stations et trajets deja choisis.
import type { GeoPoint, RouteMeasure, RoutableMode, SharedStation, TransportNetwork } from '../../types';
import { MAX_STATION_ACCESS_KM } from './constants';
import { haversineDistanceKm, nearestStation, stationCandidates, stationToPoint, stopToPoint } from './geo';
import {
    findTransitJourney,
    MAX_TRANSIT_ACCESS_KM,
    transitCandidates,
    type AccessMeasure,
    type TransitAccess,
    type TransitJourney,
} from './transit';

export type RouteMatrixMeasurer = (
    mode: RoutableMode,
    origins: GeoPoint[],
    destinations: GeoPoint[],
) => Promise<Array<Array<RouteMeasure | null>> | null>;

export interface StationAccess {
    station: SharedStation;
    measure: AccessMeasure;
}

export interface FeederAccess {
    vehicle: StationAccess;
    journey: TransitJourney;
    /** Le Velo'v doit etre rendu avant de rejoindre la station de transport. */
    dropoff: StationAccess | null;
}

export interface RouteAccessPlan {
    bike: { pickup: StationAccess; dropoff: StationAccess } | null;
    scooter: StationAccess | null;
    transit: TransitJourney | null;
    bikeTransit: FeederAccess | null;
    scooterTransit: FeederAccess | null;
}

function asAccessMeasure(measure: RouteMeasure): AccessMeasure {
    return {
        distanceKm: measure.distanceMeters / 1000,
        durationMinutes: measure.durationSeconds / 60,
    };
}

function estimatedMeasure(from: GeoPoint, to: GeoPoint): AccessMeasure {
    const distanceKm = haversineDistanceKm(from, to);
    return { distanceKm, durationMinutes: (distanceKm / 4.6) * 60 };
}

function estimatedStation(stations: SharedStation[], point: GeoPoint): StationAccess | null {
    const station = nearestStation(stations, point);
    return station ? { station, measure: estimatedMeasure(point, stationToPoint(station)) } : null;
}

async function routedStation(
    stations: SharedStation[],
    point: GeoPoint,
    direction: 'from-point' | 'to-point',
    measure: RouteMatrixMeasurer,
): Promise<StationAccess | null> {
    const candidates = stationCandidates(stations, point);
    if (candidates.length === 0) {
        return null;
    }

    const points = candidates.map(stationToPoint);
    const matrix = direction === 'from-point'
        ? await measure('walk', [point], points)
        : await measure('walk', points, [point]);
    if (!matrix) {
        return null;
    }

    let best: StationAccess | null = null;
    for (let index = 0; index < candidates.length; index += 1) {
        const cell = direction === 'from-point' ? matrix[0]?.[index] : matrix[index]?.[0];
        if (!cell) {
            continue;
        }
        const access = asAccessMeasure(cell);
        if (
            access.distanceKm <= MAX_STATION_ACCESS_KM &&
            (!best || access.durationMinutes < best.measure.durationMinutes)
        ) {
            best = { station: candidates[index], measure: access };
        }
    }
    return best;
}

function stationAccess(
    candidates: SharedStation[],
    readMeasure: (index: number) => RouteMeasure | null | undefined,
): StationAccess | null {
    let best: StationAccess | null = null;
    for (let index = 0; index < candidates.length; index += 1) {
        const cell = readMeasure(index);
        if (!cell) {
            continue;
        }
        const access = asAccessMeasure(cell);
        if (access.distanceKm <= MAX_STATION_ACCESS_KM && (!best || access.durationMinutes < best.measure.durationMinutes)) {
            best = { station: candidates[index], measure: access };
        }
    }
    return best;
}

function stopAccesses(
    candidates: ReturnType<typeof transitCandidates>,
    readMeasure: (index: number) => RouteMeasure | null | undefined,
): ReadonlyMap<string, AccessMeasure> {
    const result = new Map<string, AccessMeasure>();
    for (let index = 0; index < candidates.length; index += 1) {
        const cell = readMeasure(index);
        if (!cell) {
            continue;
        }
        const access = asAccessMeasure(cell);
        if (access.distanceKm <= MAX_TRANSIT_ACCESS_KM) {
            result.set(candidates[index].stop_id, access);
        }
    }
    return result;
}

/** Tous les acces pietons initiaux tiennent dans une seule matrice OSRM. */
async function routedWalkingAccess(
    network: TransportNetwork,
    origin: GeoPoint,
    destination: GeoPoint,
    requireAccessible: boolean,
    bikePickups: SharedStation[],
    bikeDropoffs: SharedStation[],
    scooters: SharedStation[],
    measure: RouteMatrixMeasurer,
) {
    const pickupCandidates = stationCandidates(bikePickups, origin);
    const dropoffCandidates = stationCandidates(bikeDropoffs, destination);
    const scooterCandidates = stationCandidates(scooters, origin);
    const departureCandidates = transitCandidates(network, origin, requireAccessible);
    const arrivalCandidates = transitCandidates(network, destination, requireAccessible);
    const origins = [origin, ...dropoffCandidates.map(stationToPoint), ...arrivalCandidates.map(stopToPoint)];
    const destinations = [
        ...pickupCandidates.map(stationToPoint),
        ...scooterCandidates.map(stationToPoint),
        ...departureCandidates.map(stopToPoint),
        destination,
    ];
    const matrix = await measure('walk', origins, destinations);
    if (!matrix) {
        return {
            bikePickup: null,
            bikeDropoff: null,
            scooter: null,
            transitDepartures: new Map<string, AccessMeasure>(),
            transitArrivals: new Map<string, AccessMeasure>(),
        };
    }

    const scooterOffset = pickupCandidates.length;
    const departureOffset = scooterOffset + scooterCandidates.length;
    const destinationIndex = destinations.length - 1;
    const arrivalOriginOffset = 1 + dropoffCandidates.length;
    return {
        bikePickup: stationAccess(pickupCandidates, (index) => matrix[0]?.[index]),
        bikeDropoff: stationAccess(dropoffCandidates, (index) => matrix[index + 1]?.[destinationIndex]),
        scooter: stationAccess(scooterCandidates, (index) => matrix[0]?.[scooterOffset + index]),
        transitDepartures: stopAccesses(departureCandidates, (index) => matrix[0]?.[departureOffset + index]),
        transitArrivals: stopAccesses(
            arrivalCandidates,
            (index) => matrix[arrivalOriginOffset + index]?.[destinationIndex],
        ),
    };
}

/** Velo et trottinette partagent le meme profil OSRM et donc la meme matrice. */
async function routedFeederAccess(
    network: TransportNetwork,
    bikePickup: StationAccess | null,
    scooter: StationAccess | null,
    requireAccessible: boolean,
    measure: RouteMatrixMeasurer,
) {
    const origins = [bikePickup, scooter].filter((access): access is StationAccess => access !== null);
    if (origins.length === 0) {
        return { bikeDepartures: new Map<string, AccessMeasure>(), scooterDepartures: new Map<string, AccessMeasure>() };
    }
    const candidates = origins.map((access) =>
        transitCandidates(network, stationToPoint(access.station), requireAccessible),
    );
    const destinations = candidates.flatMap((stops) => stops.map(stopToPoint));
    if (destinations.length === 0) {
        return { bikeDepartures: new Map<string, AccessMeasure>(), scooterDepartures: new Map<string, AccessMeasure>() };
    }
    const matrix = await measure('bike', origins.map((access) => stationToPoint(access.station)), destinations);
    if (!matrix) {
        return { bikeDepartures: new Map<string, AccessMeasure>(), scooterDepartures: new Map<string, AccessMeasure>() };
    }

    let destinationOffset = 0;
    const byStation = new Map<string, ReadonlyMap<string, AccessMeasure>>();
    for (let originIndex = 0; originIndex < origins.length; originIndex += 1) {
        const stops = candidates[originIndex];
        const offset = destinationOffset;
        byStation.set(
            origins[originIndex].station.station_id,
            stopAccesses(stops, (index) => matrix[originIndex]?.[offset + index]),
        );
        destinationOffset += stops.length;
    }

    return {
        bikeDepartures: bikePickup ? byStation.get(bikePickup.station.station_id) ?? new Map() : new Map(),
        scooterDepartures: scooter ? byStation.get(scooter.station.station_id) ?? new Map() : new Map(),
    };
}

function buildJourney(
    network: TransportNetwork,
    from: GeoPoint,
    destination: GeoPoint,
    requireAccessible: boolean,
    departures: ReadonlyMap<string, AccessMeasure>,
    arrivals: ReadonlyMap<string, AccessMeasure>,
): TransitJourney | null {
    const access: TransitAccess = { departures, arrivals };
    return findTransitJourney(network, from, destination, requireAccessible, access);
}

/**
 * Plan de repli pour les tests purs du moteur. Le parcours utilisateur appelle
 * `prepareRoutedAccessPlan` et ne prend donc aucune decision sur ces estimations.
 */
export function estimateRouteAccessPlan(request: {
    origin: GeoPoint;
    destination: GeoPoint;
    network: TransportNetwork;
    requireAccessible: boolean;
}): RouteAccessPlan {
    const { origin, destination, network, requireAccessible } = request;
    const stations = network.sharedMobility.data.stations;
    const bikePickups = stations.filter(
        (station) => station.kind === 'velov' && station.is_installed && station.is_renting && station.bikes_available > 0,
    );
    const bikeDropoffs = stations.filter(
        (station) => station.kind === 'velov' && station.is_installed && station.is_returning,
    );
    const scooters = stations.filter(
        (station) => station.kind === 'scooter' && station.is_renting && station.scooters_available > 0,
    );
    const bikePickup = estimatedStation(bikePickups, origin);
    const bikeDropoff = estimatedStation(bikeDropoffs, destination);
    const scooter = estimatedStation(scooters, origin);
    const transit = findTransitJourney(network, origin, destination, requireAccessible);
    const bikeJourney = bikePickup
        ? findTransitJourney(network, stationToPoint(bikePickup.station), destination, requireAccessible)
        : null;
    const transitBikeDropoff = bikeJourney
        ? estimatedStation(bikeDropoffs, stopToPoint(bikeJourney.rides[0].boarding))
        : null;
    const scooterJourney = scooter
        ? findTransitJourney(network, stationToPoint(scooter.station), destination, requireAccessible)
        : null;

    return {
        bike: bikePickup && bikeDropoff ? { pickup: bikePickup, dropoff: bikeDropoff } : null,
        scooter,
        transit,
        bikeTransit:
            bikePickup && bikeJourney && transitBikeDropoff
                ? { vehicle: bikePickup, journey: bikeJourney, dropoff: transitBikeDropoff }
                : null,
        scooterTransit: scooter && scooterJourney ? { vehicle: scooter, journey: scooterJourney, dropoff: null } : null,
    };
}

export async function prepareRoutedAccessPlan(
    request: {
        origin: GeoPoint;
        destination: GeoPoint;
        network: TransportNetwork;
        requireAccessible: boolean;
    },
    measure: RouteMatrixMeasurer,
): Promise<RouteAccessPlan> {
    const { origin, destination, network, requireAccessible } = request;
    const stations = network.sharedMobility.data.stations;
    const bikePickups = stations.filter(
        (station) => station.kind === 'velov' && station.is_installed && station.is_renting && station.bikes_available > 0,
    );
    const bikeDropoffs = stations.filter(
        (station) => station.kind === 'velov' && station.is_installed && station.is_returning,
    );
    const scooters = stations.filter(
        (station) => station.kind === 'scooter' && station.is_renting && station.scooters_available > 0,
    );

    const { bikePickup, bikeDropoff, scooter, transitDepartures, transitArrivals } = await routedWalkingAccess(
        network,
        origin,
        destination,
        requireAccessible,
        bikePickups,
        bikeDropoffs,
        scooters,
        measure,
    );
    const { bikeDepartures, scooterDepartures } = await routedFeederAccess(
        network,
        bikePickup,
        scooter,
        requireAccessible,
        measure,
    );

    const transit = buildJourney(network, origin, destination, requireAccessible, transitDepartures, transitArrivals);
    const bikeJourney = bikePickup
        ? buildJourney(
            network,
            stationToPoint(bikePickup.station),
            destination,
            requireAccessible,
            bikeDepartures,
            transitArrivals,
        )
        : null;
    const scooterJourney = scooter
        ? buildJourney(
            network,
            stationToPoint(scooter.station),
            destination,
            requireAccessible,
            scooterDepartures,
            transitArrivals,
        )
        : null;
    const transitBikeDropoff = bikeJourney
        ? await routedStation(
            bikeDropoffs,
            stopToPoint(bikeJourney.rides[0].boarding),
            'to-point',
            measure,
        )
        : null;

    return {
        bike: bikePickup && bikeDropoff ? { pickup: bikePickup, dropoff: bikeDropoff } : null,
        scooter,
        transit,
        bikeTransit:
            bikePickup && bikeJourney && transitBikeDropoff
                ? { vehicle: bikePickup, journey: bikeJourney, dropoff: transitBikeDropoff }
                : null,
        scooterTransit: scooter && scooterJourney ? { vehicle: scooter, journey: scooterJourney, dropoff: null } : null,
    };
}
