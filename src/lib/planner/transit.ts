// Recherche d'un trajet en transport public sur la desserte reelle.
//
// Avant, le moteur prenait l'arret le plus proche du depart, l'arret le plus
// proche de l'arrivee, et leur collait la ligne au passage le plus frequent du
// reseau. Rien ne garantissait qu'une ligne desserve ces deux arrets, ni meme
// l'un des deux : l'arret le plus proche est presque toujours un arret de bus,
// et le libelle affiche n'avait donc aucun rapport avec le trajet (B12).
//
// Ici on part de la desserte publiee : on ne retient que les stations
// desservies par une ligne structurante, et on ne propose un trajet que si une
// ligne relie effectivement la montee a la descente — directement, ou par une
// correspondance a une station commune aux deux lignes.
import type { GeoPoint, GtfsRoute, GtfsStop, RouteLeg, TransportNetwork } from '../../types';
import { SPEED_KMH } from './constants';
import { transitEmissionFactor } from './emissions';
import { haversineDistanceKm, stopToPoint } from './geo';
import { routeLabel } from './labels';
import { createLeg } from './legs';
import { pathLengthKm, sliceShape } from './shape';

/** Distance de rabattement a pied acceptee vers une station, en kilometres. */
export const MAX_TRANSIT_ACCESS_KM = 1.2;

/**
 * Nombre de stations candidates retenues de chaque cote. La plus proche n'est
 * pas toujours la meilleure : une station un peu plus loin peut porter la ligne
 * qui va droit au but. Huit couvre le centre dense sans faire exploser le
 * nombre de combinaisons a evaluer.
 */
const MAX_CANDIDATES = 8;

/** Penalite forfaitaire d'une correspondance, en minutes. */
const TRANSFER_PENALTY_MINUTES = 4;

export interface TransitRide {
    route: GtfsRoute;
    boarding: GtfsStop;
    alighting: GtfsStop;
    /** Portion du trace reel de la ligne entre les deux stations. */
    path: GeoPoint[];
    distanceKm: number;
    waitMinutes: number;
}

export interface TransitJourney {
    rides: TransitRide[];
    departureAccess: AccessMeasure;
    arrivalAccess: AccessMeasure;
    /** Duree estimee de bout en bout, marche de rabattement comprise. */
    totalMinutes: number;
}

export interface AccessMeasure {
    distanceKm: number;
    durationMinutes: number;
}

/** Mesures reelles des acces aux stations candidates, indexees par arret. */
export interface TransitAccess {
    departures: ReadonlyMap<string, AccessMeasure>;
    arrivals: ReadonlyMap<string, AccessMeasure>;
}

/** Seules les stations desservies par une ligne structurante sont exploitables. */
function servedStations(network: TransportNetwork, requireAccessible: boolean): GtfsStop[] {
    return network.gtfs.stops.filter(
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

/** Filtre geographique borne avant le classement des acces par OSRM. */
export function transitCandidates(network: TransportNetwork, point: GeoPoint, requireAccessible: boolean): GtfsStop[] {
    return nearestCandidates(servedStations(network, requireAccessible), point);
}

function walkMinutes(distanceKm: number): number {
    return (distanceKm / SPEED_KMH.walk) * 60;
}

function buildRide(network: TransportNetwork, routeId: string, boarding: GtfsStop, alighting: GtfsStop): TransitRide | null {
    const route = network.gtfs.routes.find((item) => item.route_id === routeId);
    if (!route || boarding.stop_id === alighting.stop_id) {
        return null;
    }

    // Une ligne droite entre deux stations ressemble a un trajet reel alors
    // qu'elle peut traverser des batiments. Sans portion officielle exploitable,
    // cette desserte n'est donc pas proposee (B14).
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

function rideMinutes(ride: TransitRide): number {
    return (ride.distanceKm / SPEED_KMH.transit) * 60 + ride.waitMinutes;
}

/** Stations desservies a la fois par `first` et par `second`. */
function interchanges(stations: GtfsStop[], first: string, second: string): GtfsStop[] {
    return stations.filter((stop) => stop.routes.includes(first) && stop.routes.includes(second));
}

/**
 * Meilleur trajet en transport public entre deux points, ou `null` si aucune
 * ligne ne les relie en une correspondance au plus. Le critere est la duree
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

    let best: TransitJourney | null = null;

    const consider = (rides: TransitRide[], extraMinutes: number) => {
        const boarding = rides[0].boarding;
        const alighting = rides[rides.length - 1].alighting;
        const departureAccess = access?.departures.get(boarding.stop_id) ?? {
            distanceKm: haversineDistanceKm(from, stopToPoint(boarding)),
            durationMinutes: walkMinutes(haversineDistanceKm(from, stopToPoint(boarding))),
        };
        const arrivalAccess = access?.arrivals.get(alighting.stop_id) ?? {
            distanceKm: haversineDistanceKm(stopToPoint(alighting), to),
            durationMinutes: walkMinutes(haversineDistanceKm(stopToPoint(alighting), to)),
        };
        const totalMinutes =
            departureAccess.durationMinutes +
            arrivalAccess.durationMinutes +
            rides.reduce((sum, ride) => sum + rideMinutes(ride), 0) +
            extraMinutes;
        if (!best || totalMinutes < best.totalMinutes) {
            best = { rides, departureAccess, arrivalAccess, totalMinutes };
        }
    };

    for (const departure of departures) {
        for (const arrival of arrivals) {
            if (departure.stop_id === arrival.stop_id) {
                continue;
            }

            for (const line of departure.routes) {
                if (arrival.routes.includes(line)) {
                    const ride = buildRide(network, line, departure, arrival);
                    if (ride) {
                        consider([ride], 0);
                    }
                    continue;
                }

                // Pas de ligne commune : on cherche une station ou la ligne du depart
                // croise une ligne desservant l'arrivee.
                for (const secondLine of arrival.routes) {
                    for (const hub of interchanges(stations, line, secondLine)) {
                        const first = buildRide(network, line, departure, hub);
                        const second = buildRide(network, secondLine, hub, arrival);
                        if (first && second) {
                            consider([first, second], TRANSFER_PENALTY_MINUTES);
                        }
                    }
                }
            }
        }
    }

    return best;
}

/**
 * Segments d'un trajet en transport public. Tous les generateurs d'options qui
 * empruntent le reseau (transport seul, velo ou trottinette + transport)
 * partagent cette construction : le libelle, la couleur et la duree d'un segment ne doivent pas
 * dependre du generateur qui l'appelle.
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
                    title: 'Correspondance a pied',
                    from: { ...stopToPoint(previous.alighting), label: `Quai ${routeLabel(previous.route)}` },
                    to: { ...stopToPoint(ride.boarding), label: `Quai ${label}` },
                    distanceKm: 0,
                    accessible: previous.alighting.wheelchair_boarding === 1 && ride.boarding.wheelchair_boarding === 1,
                    estimate: { overheadMinutes: TRANSFER_PENALTY_MINUTES },
                }),
                transfer: true,
                detail: `Correspondance dans ${ride.boarding.stop_name}, ${TRANSFER_PENALTY_MINUTES} min estimees. Le trace interieur n'est pas publie par le GTFS.`,
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
                accessible: ride.boarding.wheelchair_boarding === 1 && ride.alighting.wheelchair_boarding === 1,
                // Seule geometrie reelle disponible sans appel reseau : le trace
                // publie de la ligne, deja decoupe entre les deux stations.
                path: ride.path,
                // L'attente a quai n'est pas du temps de parcours : elle ne doit pas
                // suivre la distance. La correspondance est un segment separe.
                estimate: {
                    overheadMinutes: ride.waitMinutes,
                    carbonGramsPerKm: transitEmissionFactor(ride.route.route_type).gramsCo2ePerPassengerKm,
                },
            }),
            mapLabel: label,
            mapColor: `#${ride.route.route_color}`,
            detail: `${label} au depart de ${ride.boarding.stop_name}, attente estimee ${ride.waitMinutes} min.`,
        };
        return [...transfer, transitLeg];
    });
}
