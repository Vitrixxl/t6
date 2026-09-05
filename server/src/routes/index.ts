// Montage de toutes les routes de l'API.
import { Elysia } from 'elysia';
import type { ServerConfig } from '../config/index.ts';
import type { AppContext } from '../plugins/context.ts';
import { authRoutes } from './auth.ts';
import { healthRoutes } from './health.ts';
import { meRoutes } from './me.ts';
import { plannedTripRoutes } from './planned-trips.ts';
import { recurringTripRoutes } from './recurring-trips.ts';
import { transportRoutes } from './transport.ts';
import { savedRouteRoutes } from './saved-routes.ts';
import { tripHistoryRoutes } from './trip-history.ts';

export function routes(ctx: AppContext, config: ServerConfig) {
    return new Elysia({ name: 'routes' })
        .use(healthRoutes())
        .use(authRoutes(ctx, config))
        .use(meRoutes(ctx))
        .use(plannedTripRoutes(ctx))
        .use(recurringTripRoutes(ctx))
        .use(tripHistoryRoutes(ctx))
        .use(savedRouteRoutes(ctx))
        .use(transportRoutes(ctx, config));
}
