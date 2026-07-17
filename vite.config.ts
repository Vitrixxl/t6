import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Pas de source map publiee en production : evite ~4 Mo de poids et
    // n'expose pas le code source. Reactiver ponctuellement pour deboguer un build.
    sourcemap: false,
    target: 'es2022',
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
});
