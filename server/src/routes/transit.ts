// Relais des alertes trafic TCL. La route ne fait que traduire l'instantane du
// service en reponse HTTP.
import { Elysia } from 'elysia';
import type { ServerConfig } from '../config/index.ts';
import { createTransitAlerts } from '../services/transit-alerts.ts';

export function transitRoutes(config: ServerConfig) {
  const alerts = createTransitAlerts(config);

  return new Elysia({ tags: ['Transport'] }).get(
    '/tcl-alertes',
    async ({ set }) => {
      const snapshot = await alerts.snapshot();

      set.status = snapshot.status;
      set.headers['content-type'] = 'application/json';
      set.headers['cache-control'] = 'no-store';
      // Le client affiche la fraicheur de la donnee : ces en-tetes lui evitent
      // de deduire l'age du flux a partir de son propre horodatage.
      set.headers['x-upstream-fetched-at'] = String(snapshot.fetchedAt);
      set.headers['x-upstream-changed-at'] = String(snapshot.changedAt);
      return snapshot.body;
    },
    { detail: { summary: 'Alertes trafic TCL (cache 30 s partage)' } },
  );
}
