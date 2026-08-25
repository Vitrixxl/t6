// En-tetes de securite (OWASP A05 - mauvaise configuration).
//
// Ecrit a la main plutot qu'importe : le plugin helmet de l'ecosysteme Elysia
// n'est pas compatible avec la version majeure utilisee ici, et une API qui ne
// sert que du JSON n'a besoin que de ces cinq en-tetes. Une dependance de plus
// serait une surface d'attaque et une dette de maintenance pour trente lignes.
import { Elysia } from 'elysia';

export function securityHeaders(isProduction: boolean) {
  return new Elysia({ name: 'security-headers' })
    .onAfterHandle(({ set }) => {
      // L'API ne renvoie que du JSON : rien a executer, rien a integrer.
      set.headers['content-security-policy'] = "default-src 'none'; frame-ancestors 'none'";
      set.headers['x-content-type-options'] = 'nosniff';
      set.headers['x-frame-options'] = 'DENY';
      set.headers['referrer-policy'] = 'no-referrer';
      set.headers['cross-origin-resource-policy'] = 'same-origin';
      if (isProduction) {
        // Uniquement en production : en developpement le serveur ecoute en
        // clair, imposer HSTS bloquerait l'acces local.
        set.headers['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
      }
    })
    .as('global');
}
