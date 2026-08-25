// Journal des requetes : une ligne structuree par requete servie.
//
// Sans trace, un incident en production se diagnostique a l'aveugle. Le format
// est volontairement du JSON sur une ligne : lisible en console, indexable par
// un collecteur sans parseur specifique. Aucune donnee personnelle n'y figure
// (ni corps, ni identifiant de compte, ni adresse) : uniquement methode,
// chemin, statut et duree.
import { Elysia } from 'elysia';

export function requestLog(enabled: boolean) {
  return new Elysia({ name: 'request-log' })
    .onRequest(({ store }) => {
      (store as { startedAt?: number }).startedAt = performance.now();
    })
    .onAfterResponse(({ request, set, store }) => {
      if (!enabled) {
        return;
      }
      const startedAt = (store as { startedAt?: number }).startedAt ?? performance.now();
      console.log(
        JSON.stringify({
          method: request.method,
          path: new URL(request.url).pathname,
          status: set.status ?? 200,
          durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
        }),
      );
    })
    .as('global');
}
