// Ce qui se trouve autour d'un point : la station Vélo'v, la trottinette et
// l'arrêt les plus proches.
//
// Distinct de geo.ts, qui cherche un point d'accès *utilisable* pour construire
// un itinéraire et applique donc le seuil de marche RG3. Ici, on renseigne
// l'utilisateur : même a 900 m, savoir où est le vélo le plus proche a de la
// valeur. Aucun seuil n'est appliqué, la distance est rendue telle quelle.
import type { GeoPoint, GtfsStop, SharedStation, TransportNetwork } from '../../types';
import { haversineDistanceKm } from './geo';

export interface NearbyItem<T> {
    item: T;
    distanceKm: number;
}

export interface Nearby {
    velov: NearbyItem<SharedStation> | null;
    scooter: NearbyItem<SharedStation> | null;
    stop: NearbyItem<GtfsStop> | null;
}

function closest<T>(items: T[], point: GeoPoint, positionOf: (item: T) => GeoPoint): NearbyItem<T> | null {
    let best: NearbyItem<T> | null = null;

    // Balayage linéaire plutôt qu'un index spatial : quelques milliers de points,
    // une seule fois par changement de position. Un quadtree serait du
    // cérémonial a cette échelle.
    for (const item of items) {
        const distanceKm = haversineDistanceKm(positionOf(item), point);
        if (!best || distanceKm < best.distanceKm) {
            best = { item, distanceKm };
        }
    }

    return best;
}

const stationPosition = (station: SharedStation): GeoPoint => ({
    lat: station.lat,
    lon: station.lon,
    label: station.name,
});

const stopPosition = (stop: GtfsStop): GeoPoint => ({
    lat: stop.stop_lat,
    lon: stop.stop_lon,
    label: stop.stop_name,
});

/**
 * Ne retient que ce qui est réellement empruntable : une station en panne ou
 * vide n'aide pas l'utilisateur, l'afficher serait une fausse promesse.
 */
export function findNearby(network: TransportNetwork, point: GeoPoint): Nearby {
    const stations = network.sharedMobility.data.stations;

    return {
        velov: closest(
            stations.filter((s) => s.kind === 'velov' && s.is_renting && s.bikes_available > 0),
            point,
            stationPosition,
        ),
        scooter: closest(
            stations.filter((s) => s.kind === 'scooter' && s.is_renting && s.scooters_available > 0),
            point,
            stationPosition,
        ),
        stop: closest(network.gtfs.stops, point, stopPosition),
    };
}

/** "120 m" en dessous du kilomètre, "1,4 km" au-delà. */
export function formatDistance(distanceKm: number): string {
    if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

/** Minutes de marche, arrondies à la minute supérieure (4,6 km/h). */
export function walkMinutes(distanceKm: number): number {
    return Math.max(1, Math.ceil((distanceKm / 4.6) * 60));
}

/**
 * Nombre réel d'éléments dans le rayon, et les plus proches d'entre eux.
 *
 * Les deux sont distincts a dessein : la liste est bornée pour le rendu, le
 * compte ne l'est pas. Annoncer la longueur de la liste reviendrait a présenter
 * un plafond d'affichage comme une mesure, ce qui fut un vrai bogue (B9).
 */
export interface NearbyGroup<T> {
    count: number;
    items: NearbyItem<T>[];
}

export interface NearbyWithin {
    velov: NearbyGroup<SharedStation>;
    scooter: NearbyGroup<SharedStation>;
    stop: NearbyGroup<GtfsStop>;
}

/** Éléments listes par groupe. Au-dela, la liste cesse d'être lisible. */
const LISTED_PER_GROUP = 4;

function within<T>(items: T[], point: GeoPoint, radiusKm: number, positionOf: (item: T) => GeoPoint): NearbyGroup<T> {
    const matches: NearbyItem<T>[] = [];
    for (const item of items) {
        const distanceKm = haversineDistanceKm(positionOf(item), point);
        if (distanceKm <= radiusKm) {
            matches.push({ item, distanceKm });
        }
    }

    matches.sort((a, b) => a.distanceKm - b.distanceKm);
    return { count: matches.length, items: matches.slice(0, LISTED_PER_GROUP) };
}

export function findWithinRadius(network: TransportNetwork, point: GeoPoint, radiusKm: number): NearbyWithin {
    const stations = network.sharedMobility.data.stations;

    return {
        velov: within(
            stations.filter((s) => s.kind === 'velov' && s.is_renting && s.bikes_available > 0),
            point,
            radiusKm,
            stationPosition,
        ),
        scooter: within(
            stations.filter((s) => s.kind === 'scooter' && s.is_renting && s.scooters_available > 0),
            point,
            radiusKm,
            stationPosition,
        ),
        stop: within(network.gtfs.stops, point, radiusKm, stopPosition),
    };
}
