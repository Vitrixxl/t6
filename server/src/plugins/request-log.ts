// Journal des requêtes : une ligne structuree par requête servie.
//
// Sans trace, un incident en production se diagnostique à l'aveugle. Le format
// est volontairement du JSON sur une ligne : lisible en console, indexable par
// un collecteur sans parseur spécifique. Aucune donnée personnelle n'y figure
// (ni corps, ni identifiant de compte, ni adresse) : uniquement méthode,
// chemin, statut et durée.
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
