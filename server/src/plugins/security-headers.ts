// En-tetes de sécurité (OWASP A05 - mauvaise configuration).
//
// Ecrit à la main plutôt qu'importe : le plugin helmet de l'ecosysteme Elysia
// n'est pas compatible avec la version majeure utilisée ici, et le besoin tient
// en quelques en-têtes. Une dépendance de plus serait une surface d'attaque et
// une dette de maintenance pour trente lignes.
//
// **Deux politiques, parce qu'il y a deux natures de réponse.** Le même serveur
// rend du JSON et une application : leur imposer la même politique revient soit
// a autoriser du script sur l'API, soit a interdire au client de charger ses
// propres fichiers. La seconde erreur a été commise en fusionnant les deux
// serveurs, et l'application ne s'affichait plus du tout.
import { Elysia } from 'elysia';

/** L'API ne renvoie que du JSON : rien a exécuter, rien a integrer. */
const API_POLICY = "default-src 'none'; frame-ancestors 'none'";

/**
 * Le document, lui, charge ses propres scripts, styles, polices et images, et
 * parle à l'API de la même origine. Les tuiles de carte viennent d'OpenStreetMap
 * et les fonds de plan sont dessines dans un canevas — d'où `blob:` et `data:`,
 * que MapLibre utilise pour ses ouvriers et ses textures.
 */
const APP_POLICY = [
    "default-src 'self'",
    "script-src 'self' blob:",
    // Les styles sont injectes à l'exécution par MapLibre et par le moteur de
    // classes utilitaires : sans 'unsafe-inline', la carte s'affiche sans style.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    "font-src 'self'",
    // Le fond de plan figure ici et pas seulement dans `img-src` : MapLibre
    // récupère ses tuiles par l'API Fetch pour les dessiner dans un canevas, et
    // c'est `connect-src` qui gouverne fetch. Les autoriser comme images ne
    // suffisait pas — la carte restait vide, sans autre indice que des erreurs
    // de réseau.
    [
        "connect-src 'self'",
        'https://tile.openstreetmap.org',
        'https://api-adresse.data.gouv.fr',
        'https://photon.komoot.io',
        'https://api.cyclocity.fr',
        'https://gbfs.api.ridedott.com',
        'https://api.open-meteo.com',
    ].join(' '),
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
].join('; ');

export function securityHeaders(isProduction: boolean) {
    return new Elysia({ name: 'security-headers' })
        .onAfterHandle(({ set, path }) => {
            set.headers['content-security-policy'] = path.startsWith('/api') ? API_POLICY : APP_POLICY;
            set.headers['x-content-type-options'] = 'nosniff';
            set.headers['x-frame-options'] = 'DENY';
            set.headers['referrer-policy'] = 'no-referrer';
            set.headers['cross-origin-resource-policy'] = 'same-origin';
            if (isProduction) {
                // Uniquement en production : en développement le serveur peut ecouter
                // en clair, et imposer HSTS bloquerait l'accès local.
                set.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
            }
        })
        .as('global');
}
