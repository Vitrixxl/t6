// En-tetes de securite (OWASP A05 - mauvaise configuration).
//
// Ecrit a la main plutot qu'importe : le plugin helmet de l'ecosysteme Elysia
// n'est pas compatible avec la version majeure utilisee ici, et le besoin tient
// en quelques en-tetes. Une dependance de plus serait une surface d'attaque et
// une dette de maintenance pour trente lignes.
//
// **Deux politiques, parce qu'il y a deux natures de reponse.** Le meme serveur
// rend du JSON et une application : leur imposer la meme politique revient soit
// a autoriser du script sur l'API, soit a interdire au client de charger ses
// propres fichiers. La seconde erreur a ete commise en fusionnant les deux
// serveurs, et l'application ne s'affichait plus du tout.
import { Elysia } from 'elysia';

/** L'API ne renvoie que du JSON : rien a executer, rien a integrer. */
const API_POLICY = "default-src 'none'; frame-ancestors 'none'";

/**
 * Le document, lui, charge ses propres scripts, styles, polices et images, et
 * parle a l'API de la meme origine. Les tuiles de carte viennent d'OpenStreetMap
 * et les fonds de plan sont dessines dans un canevas — d'ou `blob:` et `data:`,
 * que MapLibre utilise pour ses ouvriers et ses textures.
 */
const APP_POLICY = [
    "default-src 'self'",
    "script-src 'self' blob:",
    // Les styles sont injectes a l'execution par MapLibre et par le moteur de
    // classes utilitaires : sans 'unsafe-inline', la carte s'affiche sans style.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    "font-src 'self'",
    // Le fond de plan figure ici et pas seulement dans `img-src` : MapLibre
    // recupere ses tuiles par l'API Fetch pour les dessiner dans un canevas, et
    // c'est `connect-src` qui gouverne fetch. Les autoriser comme images ne
    // suffisait pas — la carte restait vide, sans autre indice que des erreurs
    // de reseau.
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
                // Uniquement en production : en developpement le serveur peut ecouter
                // en clair, et imposer HSTS bloquerait l'acces local.
                set.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
            }
        })
        .as('global');
}
