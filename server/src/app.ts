// Assemblage de l'API.
//
// createApp() est pur : il recoit sa configuration et rend une application
// Elysia sans ouvrir de port. Les tests appellent donc les routes en memoire
// (app.handle(new Request(...))), sans reseau ni port a reserver.
//
// L'ordre de montage compte : les plugins transverses (en-tetes, journal,
// debit, erreurs) sont installes avant les routes, pour s'appliquer a toutes.
import { Elysia } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { loadConfig } from './config/index.ts';
import type { ServerConfig } from './config/index.ts';
import { context } from './plugins/context.ts';
import { errorHandler } from './plugins/errors.ts';
import { rateLimit } from './plugins/rate-limit.ts';
import { requestLog } from './plugins/request-log.ts';
import { securityHeaders } from './plugins/security-headers.ts';
import { routes } from './routes/index.ts';

/** Un lot de synchronisation est borne : au-dela, la requete est refusee
 *  avant meme d'etre lue en entier. */
const MAX_BODY_BYTES = 512 * 1024;

export function createApp(overrides: Partial<ServerConfig> = {}) {
  const config = { ...loadConfig(), ...overrides };
  const ctx = context(config);

  return new Elysia({ prefix: '/api', serve: { maxRequestBodySize: MAX_BODY_BYTES } })
    .use(ctx)
    .use(errorHandler())
    .use(securityHeaders(config.isProduction))
    .use(requestLog(config.isProduction))
    // Limitation globale ; les routes d'authentification resserrent encore.
    .use(rateLimit({ max: 300, windowMs: 60_000, scope: 'global', trustProxy: config.trustProxy }))
    // Documentation OpenAPI generee a partir des schemas des routes : elle ne
    // peut pas deriver du code puisqu'elle en est extraite.
    .use(
      openapi({
        path: '/doc',
        documentation: {
          info: {
            title: 'API UrbanFlow Mobility',
            version: '1.0.0',
            description: "API de la plateforme de mobilite urbaine : comptes, profils, trajets et synchronisation.",
          },
        },
      }),
    )
    .use(routes(ctx, config));
}

export type App = ReturnType<typeof createApp>;
