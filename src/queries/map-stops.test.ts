import { afterEach, expect, it, spyOn } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { visibleStopCells } from '../lib/transport/map-cells';
import { mapStopsQuery } from './map-stops';

const clients: QueryClient[] = [];
afterEach(() => { for (const client of clients.splice(0)) client.clear(); });

it('réutilise les cellules communes entre cadrages et ne charge rien au zoom régional', async () => {
    const network = spyOn(globalThis, 'fetch');
    network.mockImplementation(Object.assign(async () => Response.json({ stops: [] }), { preconnect: globalThis.fetch.preconnect }));
    const client = new QueryClient();
    clients.push(client);
    try {
        const first = visibleStopCells({ west: 4.801, east: 4.849, south: 45.751, north: 45.799 }, 12);
        const second = visibleStopCells({ west: 4.811, east: 4.859, south: 45.751, north: 45.799 }, 12);
        for (const cell of first) await client.fetchQuery(mapStopsQuery(cell, 'v1'));
        expect(network).toHaveBeenCalledTimes(1);
        for (const cell of second) await client.fetchQuery(mapStopsQuery(cell, 'v1'));
        expect(network).toHaveBeenCalledTimes(2);
        for (const cell of first) await client.fetchQuery(mapStopsQuery(cell, 'v1'));
        expect(network).toHaveBeenCalledTimes(2);
        expect(visibleStopCells({ west: -180, east: 180, south: -85, north: 85 }, 5)).toEqual([]);
        for (const cell of first) await client.fetchQuery(mapStopsQuery(cell, 'v2'));
        expect(network).toHaveBeenCalledTimes(3);
    } finally { network.mockRestore(); }
});
