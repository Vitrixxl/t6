// Recherche d'un trajet en transport public sur la desserte réelle.
//
// Avant, le moteur prenait l'arrêt le plus proche du départ, l'arrêt le plus
// proche de l'arrivée, et leur collait la ligne au passage le plus frequent du
// réseau. Rien ne garantissait qu'une ligne desserve ces deux arrêts, ni même
// l'un des deux : l'arrêt le plus proche est presque toujours un arrêt de bus,
// et le libellé affiché n'avait donc aucun rapport avec le trajet (B12).
//
// Ici on part de la desserte publiée : on ne retient que les stations
// desservies par une ligne publiée, et on ne propose un trajet que si une
// ligne relie effectivement la montée à la descente — directement, ou par une
// correspondance à une station commune aux deux lignes.
import type { GeoPoint, GtfsRoute, GtfsStop, RouteLeg, TransportNetwork } from '../../types';
import { SPEED_KMH } from './constants';
import { transitEmissionFactor } from './emissions';
import { haversineDistanceKm, stopToPoint } from './geo';
import { routeLabel } from './labels';
import { createLeg } from './legs';
import { pathLengthKm, sliceShape } from './shape';

/** Distance de rabattement à pied acceptee vers une station, en kilomètres. */
export const MAX_TRANSIT_ACCESS_KM = 1.2;

/**
 * Nombre de stations candidates retenues de chaque côté. La plus proche n'est
 * pas toujours la meilleure : une station un peu plus loin peut porter la ligne
 * qui va droit au but. Huit couvre le centre dense sans faire exploser le
 * nombre de combinaisons a evaluer.
 */
const MAX_CANDIDATES = 8;

/** Pénalité forfaitaire d'une correspondance, en minutes. */
const TRANSFER_PENALTY_MINUTES = 4;

export interface TransitRide {
    route: GtfsRoute;
    boarding: GtfsStop;
    alighting: GtfsStop;
    /** Portion du tracé réel de la ligne entre les deux stations. */
    path: GeoPoint[];
    distanceKm: number;
    waitMinutes: number;
}

export interface TransitJourney {
    rides: TransitRide[];
    departureAccess: AccessMeasure;
    arrivalAccess: AccessMeasure;
    /** Durée estimée de bout en bout, marche de rabattement comprise. */
    totalMinutes: number;
}

export interface AccessMeasure {
    distanceKm: number;
    durationMinutes: number;
}

/** Mesures réelles des accès aux stations candidates, indexees par arrêt. */
export interface TransitAccess {
    departures: ReadonlyMap<string, AccessMeasure>;
    arrivals: ReadonlyMap<string, AccessMeasure>;
}

/** Seuls les arrêts dont la desserte est publiée sont exploitables. */
function servedStations(network: TransportNetwork, requireAccessible: boolean): GtfsStop[] {
    const accessibleLines = new Set(network.gtfs.routes
        .filter(route => route.route_type !== 3 || route.wheelchairAccessible === true)
        .map(route => route.route_id));
    return network.gtfs.stops
        .map(stop => requireAccessible ? { ...stop, routes: stop.routes.filter(id => accessibleLines.has(id)) } : stop)
        .filter(
        (stop) => stop.routes.length > 0 && (!requireAccessible || stop.wheelchair_boarding === 1),
    );
}

function nearestCandidates(stations: GtfsStop[], point: GeoPoint): GtfsStop[] {
    return stations
        .map((stop) => ({ stop, distanceKm: haversineDistanceKm(stopToPoint(stop), point) }))
        .filter((entry) => entry.distanceKm <= MAX_TRANSIT_ACCESS_KM)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, MAX_CANDIDATES)
        .map((entry) => entry.stop);
}

/** Filtre géographique borne avant le classement des accès par OSRM. */
export function transitCandidates(network: TransportNetwork, point: GeoPoint, requireAccessible: boolean): GtfsStop[] {
    return nearestCandidates(servedStations(network, requireAccessible), point);
}

function walkMinutes(distanceKm: number): number {
    return (distanceKm / SPEED_KMH.walk) * 60;
}

function servesInOrder(route: GtfsRoute, boarding: GtfsStop, alighting: GtfsStop): boolean {
    if (route.route_type !== 3) return true;
    const sequence = route.stopSequence ?? [];
    const start = sequence.indexOf(boarding.stop_id);
    return start >= 0 && sequence.indexOf(alighting.stop_id) > start;
}

function buildRide(network: TransportNetwork, routeId: string, boarding: GtfsStop, alighting: GtfsStop): TransitRide | null {
    const route = network.gtfs.routes.find((item) => item.route_id === routeId);
    if (!route || boarding.stop_id === alighting.stop_id || !servesInOrder(route, boarding, alighting)) {
        return null;
    }

    // Une ligne droite entre deux stations ressemble à un trajet réel alors
    // qu'elle peut traverser des batiments. Sans portion officielle exploitable,
    // cette desserte n'est donc pas proposée (B14).
    const path = sliceShape(route.shape, boarding, alighting);
    if (!path) {
        return null;
    }
    const trip = network.gtfs.trips.find((item) => item.route_id === routeId);
    const headway = trip ? trip.headway_minutes : 10;
    const delay = trip ? trip.realtime_delay_minutes : 0;

    return {
        route,
        boarding,
        alighting,
        path,
        distanceKm: pathLengthKm(path),
        waitMinutes: Math.ceil(headway / 2 + delay),
    };
}

// Hypothèse urbaine explicite : 15 km/h pour le bus, sans données de circulation.
function transitSpeed(route: GtfsRoute): number {
    return route.route_type === 3 ? 15 : SPEED_KMH.transit;
}

function rideMinutes(ride: TransitRide): number {
    return (ride.distanceKm / transitSpeed(ride.route)) * 60 + ride.waitMinutes;
}

/** Stations desservies à la fois par `first` et par `second`. */
function interchanges(stations: GtfsStop[], first: string, second: string): GtfsStop[] {
    return stations.filter((stop) => stop.routes.includes(first) && stop.routes.includes(second));
}

function accessMeasure(measured: AccessMeasure | undefined, from: GeoPoint, to: GeoPoint): AccessMeasure {
    if (measured) {
        return measured;
    }
    const distanceKm = haversineDistanceKm(from, to);
    return { distanceKm, durationMinutes: walkMinutes(distanceKm) };
}

function directRides(network: TransportNetwork, departure: GtfsStop, arrival: GtfsStop): TransitRide[][] {
    return departure.routes
        .filter((routeId) => arrival.routes.includes(routeId))
        .map((routeId) => buildRide(network, routeId, departure, arrival))
        .filter((ride): ride is TransitRide => ride !== null)
        .map((ride) => [ride]);
}

function transferRides(
    network: TransportNetwork,
    stations: GtfsStop[],
    departure: GtfsStop,
    arrival: GtfsStop,
): TransitRide[][] {
    return departure.routes
        .filter((firstLine) => !arrival.routes.includes(firstLine))
        .flatMap((firstLine) => arrival.routes.flatMap((secondLine) =>
            interchanges(stations, firstLine, secondLine).map((hub) => {
                const first = buildRide(network, firstLine, departure, hub);
                const second = buildRide(network, secondLine, hub, arrival);
                return first && second ? [first, second] : null;
            }),
        ))
        .filter((rides): rides is TransitRide[] => rides !== null);
}

function rideOptions(
    network: TransportNetwork,
    stations: GtfsStop[],
    departure: GtfsStop,
    arrival: GtfsStop,
): TransitRide[][] {
    if (departure.stop_id === arrival.stop_id) {
        return [];
    }
    return [
        ...directRides(network, departure, arrival),
        ...transferRides(network, stations, departure, arrival),
    ];
}

function journeyFromRides(
    rides: TransitRide[],
    from: GeoPoint,
    to: GeoPoint,
    access?: TransitAccess,
): TransitJourney {
    const boarding = rides[0].boarding;
    const alighting = rides[rides.length - 1].alighting;
    const departureAccess = accessMeasure(access?.departures.get(boarding.stop_id), from, stopToPoint(boarding));
    const arrivalAccess = accessMeasure(access?.arrivals.get(alighting.stop_id), stopToPoint(alighting), to);
    const transferMinutes = rides.length > 1 ? TRANSFER_PENALTY_MINUTES : 0;
    const totalMinutes = departureAccess.durationMinutes
        + arrivalAccess.durationMinutes
        + rides.reduce((sum, ride) => sum + rideMinutes(ride), 0)
        + transferMinutes;
    return { rides, departureAccess, arrivalAccess, totalMinutes };
}

/**
 * Meilleur trajet en transport public entre deux points, ou `null` si aucune
 * ligne ne les relie en une correspondance au plus. Le critère est la durée
 * totale : marche de rabattement, attente, temps a bord, correspondance.
 */
export function findTransitJourney(
    network: TransportNetwork,
    from: GeoPoint,
    to: GeoPoint,
    requireAccessible: boolean,
    access?: TransitAccess,
): TransitJourney | null {
    const stations = servedStations(network, requireAccessible);
    const departures = access
        ? stations.filter((stop) => access.departures.has(stop.stop_id))
        : nearestCandidates(stations, from);
    const arrivals = access
        ? stations.filter((stop) => access.arrivals.has(stop.stop_id))
        : nearestCandidates(stations, to);
    if (departures.length === 0 || arrivals.length === 0) {
        return null;
    }

    const journeys = departures.flatMap((departure) => arrivals.flatMap((arrival) =>
        rideOptions(network, stations, departure, arrival)
            .map((rides) => journeyFromRides(rides, from, to, access)),
    ));
    return journeys.reduce<TransitJourney | null>(
        (best, candidate) => !best || candidate.totalMinutes < best.totalMinutes ? candidate : best,
        null,
    );
}

/**
 * Segments d'un trajet en transport public. Tous les générateurs d'options qui
 * empruntent le réseau (transport seul, vélo ou trottinette + transport)
 * partagent cette construction : le libellé, la couleur et la durée d'un segment ne doivent pas
 * dependre du générateur qui l'appelle.
 */
export function transitLegs(journey: TransitJourney, idPrefix: string): RouteLeg[] {
    return journey.rides.flatMap((ride, index) => {
        const label = routeLabel(ride.route);
        const previous = journey.rides[index - 1];
        const transfer: RouteLeg[] = previous
            ? [{
                ...createLeg({
                    id: `${idPrefix}-transfer-${index}`,
                    mode: 'walk',
                    title: 'Correspondance à pied',
                    from: { ...stopToPoint(previous.alighting), label: `Quai ${routeLabel(previous.route)}` },
                    to: { ...stopToPoint(ride.boarding), label: `Quai ${label}` },
                    distanceKm: 0,
                    accessible: previous.alighting.wheelchair_boarding === 1 && ride.boarding.wheelchair_boarding === 1,
                    estimate: { overheadMinutes: TRANSFER_PENALTY_MINUTES },
                }),
                transfer: true,
                detail: `Correspondance dans ${ride.boarding.stop_name}, ${TRANSFER_PENALTY_MINUTES} min estimées. Le tracé intérieur n'est pas publié par le GTFS.`,
            }]
            : [];
        const transitLeg = {
            ...createLeg({
                id: `${idPrefix}-ride-${index}`,
                mode: 'transit',
                title: `${label} vers ${ride.alighting.stop_name}`,
                from: stopToPoint(ride.boarding),
                to: stopToPoint(ride.alighting),
                distanceKm: ride.distanceKm,
                accessible: ride.boarding.wheelchair_boarding === 1 && ride.alighting.wheelchair_boarding === 1
                    && (ride.route.route_type !== 3 || ride.route.wheelchairAccessible === true),
                // Seule géométrie réelle disponible sans appel réseau : le tracé
                // publie de la ligne, déjà decoupe entre les deux stations.
                path: ride.path,
                // L'attente a quai n'est pas du temps de parcours : elle ne doit pas
                // suivre la distance. La correspondance est un segment separe.
                estimate: {
                    overheadMinutes: ride.waitMinutes,
                    travelFactor: SPEED_KMH.transit / transitSpeed(ride.route),
                    carbonGramsPerKm: transitEmissionFactor(ride.route.route_type).gramsCo2ePerPassengerKm,
                },
            }),
            // Arrondir après le calcul à bord + attente, comme pour le classement.
            durationMinutes: Math.max(1, Math.round(rideMinutes(ride))),
            mapLabel: label,
            mapColor: `#${ride.route.route_color}`,
            detail: `${label} au départ de ${ride.boarding.stop_name}, attente estimée ${ride.waitMinutes} min.`
                + (ride.route.route_type === 3 ? ' Bus : durée modélisée à 15 km/h, intervalle supposé de 15 min ; horaires non disponibles. CO₂e : référence bus thermique, motorisation inconnue.' : ''),
        };
        return [...transfer, transitLeg];
    });
}
