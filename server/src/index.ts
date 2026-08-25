// Point d'entree du serveur : ouvre le port et gere l'arret propre.
import { createApp } from './app.ts';
import { loadConfig } from './config/index.ts';

const config = loadConfig();
const app = createApp().listen({ port: config.port, hostname: config.host });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    // Arret propre : Elysia ferme le serveur puis declenche onStop, qui ferme
    // la base de donnees.
    void app.stop().then(() => process.exit(0));
  });
}

console.log(`API UrbanFlow sur http://${config.host}:${config.port} (documentation : /api/doc)`);
