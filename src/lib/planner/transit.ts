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
import { haversineDistanceKm, stopToPoint } from './geo';
import { routeLabel } from './labels';
import { createLeg } from './legs';
import { pathLengthKm, sliceShape } from './shape';

/** Distance de rabattement a pied acceptee vers une station, en kilometres. */
const MAX_ACCESS_KM = 1.2;

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
  /** Duree estimee de bout en bout, marche de rabattement comprise. */
  totalMinutes: number;
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
    .filter((entry) => entry.distanceKm <= MAX_ACCESS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, MAX_CANDIDATES)
    .map((entry) => entry.stop);
}

function walkMinutes(distanceKm: number): number {
  return (distanceKm / SPEED_KMH.walk) * 60;
}

function buildRide(network: TransportNetwork, routeId: string, boarding: GtfsStop, alighting: GtfsStop): TransitRide | null {
  const route = network.gtfs.routes.find((item) => item.route_id === routeId);
  if (!route || boarding.stop_id === alighting.stop_id) {
    return null;
  }

  // Repli assume : si la station n'est pas sur le trace publie (antenne, sens
  // inverse decale), on relie les deux stations en direct. Le segment reste
  // moins precis, jamais faux au point de partir ailleurs.
  const path = sliceShape(route.shape, boarding, alighting) ?? [stopToPoint(boarding), stopToPoint(alighting)];
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
): TransitJourney | null {
  const stations = servedStations(network, requireAccessible);
  const departures = nearestCandidates(stations, from);
  const arrivals = nearestCandidates(stations, to);
  if (departures.length === 0 || arrivals.length === 0) {
    return null;
  }

  let best: TransitJourney | null = null;

  const consider = (rides: TransitRide[], extraMinutes: number) => {
    const boarding = rides[0].boarding;
    const alighting = rides[rides.length - 1].alighting;
    const totalMinutes =
      walkMinutes(haversineDistanceKm(from, stopToPoint(boarding))) +
      walkMinutes(haversineDistanceKm(stopToPoint(alighting), to)) +
      rides.reduce((sum, ride) => sum + rideMinutes(ride), 0) +
      extraMinutes;
    if (!best || totalMinutes < best.totalMinutes) {
      best = { rides, totalMinutes };
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
 * Segments d'un trajet en transport public. Les deux generateurs d'options qui
 * empruntent le reseau (transport seul, velo + transport) partagent cette
 * construction : le libelle, la couleur et la duree d'un segment ne doivent pas
 * dependre du generateur qui l'appelle.
 */
export function transitLegs(journey: TransitJourney, idPrefix: string): RouteLeg[] {
  return journey.rides.map((ride, index) => {
    const label = routeLabel(ride.route);
    const transferMinutes = index > 0 ? TRANSFER_PENALTY_MINUTES : 0;
    return {
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
        // L'attente a quai et la correspondance ne sont pas du temps de
        // parcours : elles ne doivent pas suivre la distance.
        estimate: { overheadMinutes: ride.waitMinutes + transferMinutes },
      }),
      mapLabel: label,
      mapColor: `#${ride.route.route_color}`,
      detail:
        index > 0
          ? `Correspondance a ${ride.boarding.stop_name}, puis ${label} (attente ${ride.waitMinutes} min).`
          : `${label} au depart de ${ride.boarding.stop_name}, attente estimee ${ride.waitMinutes} min.`,
    };
  });
}
