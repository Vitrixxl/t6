import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.API_URL ?? `http://127.0.0.1:${env.API_PORT ?? 4000}`;
  return {
  plugins: [react(), tailwindcss()],
  server: {
    // Le serveur de developpement relaie /api vers l'API : le navigateur ne
    // voit qu'une seule origine. Le cookie de session reste donc de premiere
    // partie et aucun en-tete CORS n'est necessaire (surface d'attaque en
    // moins). Si l'API n'est pas demarree, le relais echoue et l'application
    // bascule d'elle-meme en mode autonome.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
  preview: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: false },
    },
  },
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
    // Les tests du serveur tournent sous `bun test` (bun:sqlite, Bun.password) :
    // Vitest ne doit pas essayer de les charger dans un environnement Node.
    exclude: ['node_modules/**', 'dist/**', 'server/**'],
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
