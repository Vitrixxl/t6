// Montage de toutes les routes de l'API.
import { Elysia } from 'elysia';
import type { ServerConfig } from '../config/index.ts';
import type { AppContext } from '../plugins/context.ts';
import { authRoutes } from './auth.ts';
import { healthRoutes } from './health.ts';
import { meRoutes } from './me.ts';
import { routingRoutes } from './routing.ts';
import { syncRoutes } from './sync.ts';

export function routes(ctx: AppContext, config: ServerConfig) {
    return new Elysia({ name: 'routes' })
        .use(healthRoutes())
        .use(authRoutes(ctx, config))
        .use(meRoutes(ctx))
        .use(syncRoutes(ctx))
        .use(routingRoutes(ctx, config));
}
