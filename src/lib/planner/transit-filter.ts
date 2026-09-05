import type { TransportNetwork } from '../../types';

export const TRANSIT_TYPES = [
    { type: 3, label: 'Bus' },
    { type: 1, label: 'Métro' },
    { type: 0, label: 'Tramway' },
    { type: 7, label: 'Funiculaire' },
] as const;
export type TransitType = typeof TRANSIT_TYPES[number]['type'];
export const ALL_TRANSIT_TYPES: TransitType[] = TRANSIT_TYPES.map(option => option.type);

/** Filtrer avant de choisir les quais évite qu’un type exclu occupe les places candidates. */
export function filterTransitNetwork(network: TransportNetwork, types: readonly TransitType[]): TransportNetwork {
    const allowedTypes = new Set<number>(types);
    const routes = network.gtfs.routes.filter(route => allowedTypes.has(route.route_type));
    const allowedRoutes = new Set(routes.map(route => route.route_id));
    const stops = network.gtfs.stops
        .map(stop => ({ ...stop, routes: stop.routes.filter(id => allowedRoutes.has(id)) }))
        .filter(stop => stop.routes.length > 0);
    return { ...network, gtfs: {
        ...network.gtfs, routes, stops,
        trips: network.gtfs.trips.filter(trip => allowedRoutes.has(trip.route_id)),
    } };
}
