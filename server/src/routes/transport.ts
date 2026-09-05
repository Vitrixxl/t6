import { Elysia } from 'elysia';
import type { AppContext } from '../plugins/context.ts';
import type { ServerConfig } from '../config/index.ts';
import { transportContext, stopCellQuery, stopCollection, nearbyStopsQuery, nearbyStops } from '../../../src/contracts/transport.ts';
import { errorResponse } from '../../../src/contracts/primitives.ts';
import { routeSearch, routeOptions } from '../../../src/contracts/planning.ts';
import { createTransportService } from '../services/transport/index.ts';
import { createRoutingService } from '../services/routing/index.ts';
import { searchRoutes } from '../services/planning.ts';

export function transportRoutes(ctx: AppContext, config: ServerConfig) {
    const transport = createTransportService(ctx.decorator.repositories.transport);
    const routing = createRoutingService(config, ctx.decorator.repositories.routeCache);
    return new Elysia({ prefix: '/transport', tags: ['Transport'] })
        .get('/context', () => transport.context(), {
            response: transportContext,
            detail: { summary: 'Disponibilités partagées et météo, sans téléchargement du réseau TCL' },
        })
        .get('/stops', ({ query, set }) => {
            set.headers['cache-control'] = 'public, max-age=3600';
            return transport.stops(query.x, query.y);
        }, {
            query: stopCellQuery, response: stopCollection,
            detail: { summary: 'Tous les arrêts d’une cellule de la carte, sans les tracés des lignes' },
        })
        .get('/nearby-stops', ({ query }) => transport.nearby(query.lat, query.lon, query.radiusKm), {
            query: nearbyStopsQuery, response: nearbyStops,
            detail: { summary: 'Nombre réel d’arrêts dans un rayon et quatre quais les plus proches' },
        })
        .post('/journeys', async ({ body, request, set }) => {
            const options = await searchRoutes(body, transport, routing, request.signal);
            if (options.length === 0) {
                set.status = 503;
                return { error: 'Aucun itinéraire mesurable : le service de routage est indisponible ou les points sont inaccessibles.' };
            }
            return options;
        }, {
            body: routeSearch, response: { 200: routeOptions, 503: errorResponse },
            detail: { summary: 'Options multimodales mesurées sur le réseau complet ; fréquences estimées sans horaires GTFS' },
        });
}
