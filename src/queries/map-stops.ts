// Une cellule déjà visitée ne repart pas sur le réseau à chaque déplacement.
import { queryOptions, useQueries } from '@tanstack/react-query';
import { api, treatyRequest } from '../lib/api/client';
import type { StopCell } from '../lib/transport/map-cells';

export function mapStopsQuery(cell: StopCell, version: string) {
    return queryOptions({
        queryKey: ['transport-stops', version, cell.x, cell.y],
        queryFn: ({ signal }) => treatyRequest(api.transport.stops.get({ query: { ...cell, version }, fetch: { signal } })),
        staleTime: Infinity,
        gcTime: 30 * 60_000,
    });
}

export function useMapStops(cells: StopCell[], version: string) {
    return useQueries({ queries: cells.map(cell => mapStopsQuery(cell, version)) });
}
