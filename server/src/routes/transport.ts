import { Elysia } from 'elysia';
import type { AppContext } from '../plugins/context.ts';
import type { ServerConfig } from '../config/index.ts';
import { transportContext, stopCellQuery, stopCollection, nearbyStopsQuery, nearbyStops } from '../../../src/contracts/transport.ts';
import { errorResponse } from '../../../src/contracts/primitives.ts';
import { routeSearch, routeOption } from '../../../src/contracts/planning.ts';
import { createTransportService } from '../services/transport/index.ts';
import { transportCompression } from '../plugins/transport-compression.ts';
import { searchFastestRoute } from '../services/planning.ts';

export function transportRoutes(ctx: AppContext, config: ServerConfig) {
    const transport = createTransportService(ctx.decorator.repositories.transport, config.motisTransitEnabled);
    return new Elysia({ prefix: '/transport', tags: ['Transport'] })
        .use(transportCompression())
        .get('/context', () => transport.context(), {
            response: transportContext,
            detail: { summary: 'Disponibilités partagées, sans téléchargement du réseau TCL' },
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
            const context = await transport.context();
            const route = await searchFastestRoute(body, config.motisUrl, { sharedMobility: context.sharedMobility !== null, transit: context.transitRoutingAvailable, lineShapes: transport.lineShapes }, request.signal);
            if (!route) {
                set.status = 503;
                return { error: 'Aucun trajet : le moteur d’itinéraires est indisponible ou les points sont inaccessibles.' };
            }
            return route;
        }, {
            body: routeSearch, response: { 200: routeOption, 503: errorResponse },
            detail: { summary: 'Le trajet le plus rapide avec les moyens choisis, calculé par MOTIS avec reprise piétonne conditionnelle et tracés TCL officiels vérifiés' },
        });
}
