import type { Connect, Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Endpoint /api/tcl-alertes : alertes trafic TCL (SIRI SX, data.grandlyon.com).
// Le serveur appelle l'amont avec les identifiants du compte Grand Lyon (HTTP
// Basic, cote serveur uniquement - jamais exposes au navigateur), avec un cache
// memoire : chaque requete cliente redeclenche un appel amont au plus une fois
// par fenetre (limite de frequence), et le cache n'est reecrit que si la donnee
// a change. Sans identifiants valides, l'endpoint relaie l'erreur et
// l'application retombe sur les incidents simules du feed.
function tclAlertsEndpoint(env: Record<string, string>): Plugin {
  const UPSTREAM_URL =
    'https://download.data.grandlyon.com/ws/rdata/tcl_sytral.tclalertetrafic_2/all.json?maxfeatures=200';
  const MIN_UPSTREAM_INTERVAL_MS = 30_000;

  const login = env.GRANDLYON_LOGIN ?? '';
  const password = env.GRANDLYON_PASSWORD ?? '';
  const authorization = login ? `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}` : null;

  const cache = {
    body: null as string | null,
    status: 503,
    lastFetchAt: 0,
    lastChangeAt: 0,
  };
  let inflight: Promise<void> | null = null;

  async function refreshFromUpstream(): Promise<void> {
    try {
      const response = await fetch(UPSTREAM_URL, {
        headers: authorization ? { Authorization: authorization, Accept: 'application/json' } : { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.text();
      if (response.ok) {
        if (body !== cache.body) {
          cache.body = body;
          cache.lastChangeAt = Date.now();
        }
        cache.status = 200;
      } else if (cache.status !== 200) {
        // Pas encore de donnee valide en cache: on relaie l'erreur amont.
        cache.body = body;
        cache.status = response.status;
      }
      // En cas d'erreur amont avec un cache valide, on continue de servir le cache.
    } catch {
      if (cache.status !== 200) {
        cache.body = JSON.stringify({ detail: 'Flux alertes TCL injoignable.' });
        cache.status = 503;
      }
    } finally {
      cache.lastFetchAt = Date.now();
    }
  }

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/tcl-alertes')) {
      next();
      return;
    }
    void (async () => {
      const stale = Date.now() - cache.lastFetchAt >= MIN_UPSTREAM_INTERVAL_MS;
      if (stale) {
        inflight ??= refreshFromUpstream().finally(() => {
          inflight = null;
        });
      }
      if (inflight) {
        await inflight;
      }
      res.statusCode = cache.status;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Upstream-Fetched-At', String(cache.lastFetchAt));
      res.setHeader('X-Upstream-Changed-At', String(cache.lastChangeAt));
      res.end(cache.body ?? JSON.stringify({ detail: 'Flux alertes TCL indisponible.' }));
    })();
  };

  return {
    name: 'urbanflow-tcl-alerts-endpoint',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
  plugins: [react(), tailwindcss(), tclAlertsEndpoint(env)],
  build: {
    // Pas de source map publiee en production : evite ~4 Mo de poids et
    // n'expose pas le code source. Reactiver ponctuellement pour deboguer un build.
    sourcemap: false,
    target: 'es2022',
    // Le seuil d'alerte par defaut (500 kB) vise les chunks du chemin critique.
    // Le seul chunk au-dela est MapLibre (~1 MB brut, ~283 kB gzip), isole
    // volontairement et charge a la demande apres l'ecran de connexion : il ne
    // pese pas sur le chargement initial. Le seuil est releve juste au-dessus
    // pour que toute nouvelle derive de taille redevienne bloquante en revue.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        // Code-splitting : MapLibre (le gros du poids) est isole dans son propre
        // chunk et charge a la demande, pas avant l'ecran de connexion.
        manualChunks: {
          maplibre: ['maplibre-gl'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  };
});
