// Calcul d'itinéraire. La route valide, délègue au service, et traduit
// l'indisponibilité du calculateur en 503 explicite : le client doit pouvoir
// distinguer « pas de tracé » de « tracé en cours de calcul ».
import { Elysia } from 'elysia';
import type { AppContext } from '../plugins/context.ts';
import type { ServerConfig } from '../config/index.ts';
import {
    errorResponse,
    routeGeometry,
    routeMatrix,
    routeMatrixRequest,
    routeQuery,
} from '../../../src/contracts/index.ts';
import { createRoutingService, type Coordinates } from '../services/routing/index.ts';

/** `"4.832,45.7578"` -> coordonnées. Le format est vérifie par le schéma. */
function parseCoordinates(raw: string): Coordinates {
    const [lon, lat] = raw.split(',').map(Number);
    return { lat, lon };
}

export function routingRoutes(ctx: AppContext, config: ServerConfig) {
    const routing = createRoutingService(config, ctx.decorator.repositories.routeCache);

    return new Elysia({ tags: ['Transport'] })
        .get(
            '/route',
            async ({ query, set }) => {
                const result = await routing.route(query.mode, parseCoordinates(query.from), parseCoordinates(query.to));

                if (!result) {
                    set.status = 503;
                    return { error: 'Le calculateur d’itinéraires ne répond pas.' };
                }

                // Le client garde le tracé le temps de la session ; le cache partagé de
                // l'API est la vraie couche de conservation.
                set.headers['cache-control'] = 'private, max-age=300';
                return result;
            },
            {
                query: routeQuery,
                response: { 200: routeGeometry, 503: errorResponse },
                detail: { summary: 'Tracé de voirie entre deux points, avec cache partagé' },
            },
        )
        .post(
            '/route-matrix',
            async ({ body, set }) => {
                const result = await routing.matrix(body.mode, body.origins, body.destinations);
                if (!result) {
                    set.status = 503;
                    return { error: 'Le calculateur d’itinéraires ne répond pas.' };
                }
                return result;
            },
            {
                body: routeMatrixRequest,
                response: { 200: routeMatrix, 503: errorResponse },
                detail: { summary: 'Mesurer une matrice de trajets pour classer les points d’accès' },
            },
        );
}
