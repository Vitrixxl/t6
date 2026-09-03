// Point d'entree du serveur : ouvre le port et gere l'arret propre.
//
// Le serveur porte l'API **et** le client : une seule origine, donc un cookie
// de session de premiere partie et aucun en-tete CORS. Il n'y a plus de serveur
// de developpement separe ni de relais a configurer.
import { Elysia } from 'elysia';
import { createApp } from './app.ts';
import { loadConfig } from './config/index.ts';
import { securityHeaders } from './plugins/security-headers.ts';
import { staticSite } from './plugins/static-site.ts';

const config = loadConfig();

// TLS des que le certificat est fourni. Le navigateur reserve au contexte
// securise la geolocalisation, `crypto.randomUUID` et le service worker :
// sans lui, l'application ne fonctionne que sur localhost.
const tls =
  config.tlsCertPath && config.tlsKeyPath
    ? { cert: Bun.file(config.tlsCertPath), key: Bun.file(config.tlsKeyPath) }
    : undefined;

const app = new Elysia()
  // Les en-tetes de securite couvrent aussi le client : monte a la racine, le
  // plugin voit les reponses du site, pas seulement celles de l'API.
  .use(securityHeaders(config.isProduction))
  .use(createApp())
  // Monte apres l'API : la route attrape-tout du client ne doit pas prendre la
  // main sur les chemins /api.
  .use(staticSite(config.webRoot))
  .listen({ port: config.port, hostname: config.host, tls });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    // Arret propre : Elysia ferme le serveur puis declenche onStop, qui ferme
    // la base de donnees.
    void app.stop().then(() => process.exit(0));
  });
}

const scheme = tls ? 'https' : 'http';
console.log(`UrbanFlow sur ${scheme}://${config.host}:${config.port} (API sous /api, documentation /api/doc)`);
