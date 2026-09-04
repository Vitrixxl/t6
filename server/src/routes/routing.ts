// Calcul d'itineraire. La route valide, delegue au service, et traduit
// l'indisponibilite du calculateur en 503 explicite : le client doit pouvoir
// distinguer « pas de trace » de « trace en cours de calcul ».
import { Elysia } from 'elysia';
import type { AppContext } from '../plugins/context.ts';
import type { ServerConfig } from '../config/index.ts';
import { errorResponse, routeGeometry, routeQuery } from '../../../src/contracts/index.ts';
import { createRoutingService, type Coordinates } from '../services/routing/index.ts';

/** `"4.832,45.7578"` -> coordonnees. Le format est verifie par le schema. */
function parseCoordinates(raw: string): Coordinates {
    const [lon, lat] = raw.split(',').map(Number);
    return { lat, lon };
}

export function routingRoutes(ctx: AppContext, config: ServerConfig) {
    const routing = createRoutingService(config, ctx.decorator.repositories.routeCache);

    return new Elysia({ tags: ['Transport'] }).get(
        '/route',
        async ({ query, set }) => {
            const result = await routing.route(query.mode, parseCoordinates(query.from), parseCoordinates(query.to));

            if (!result) {
                set.status = 503;
                return { error: 'Le calculateur d itineraires ne repond pas.' };
            }

            // Le client garde le trace le temps de la session ; le cache partage de
            // l'API est la vraie couche de conservation.
            set.headers['cache-control'] = 'private, max-age=300';
            return result;
        },
        {
            query: routeQuery,
            response: { 200: routeGeometry, 503: errorResponse },
            detail: { summary: 'Trace de voirie entre deux points, avec cache partage' },
        },
    );
}
