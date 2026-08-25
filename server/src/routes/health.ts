// Sonde de disponibilite. Volontairement minimale et non authentifiee : c'est
// elle que le client interroge au demarrage pour decider s'il fonctionne en
// mode serveur ou en mode autonome, et c'est elle qu'un orchestrateur
// interrogerait pour decider de router du trafic vers l'instance.
import { Elysia, t } from 'elysia';

export function healthRoutes() {
  return new Elysia({ tags: ['Exploitation'] }).get(
    '/health',
    () => ({ status: 'ok' as const, time: new Date().toISOString() }),
    {
      response: t.Object({ status: t.Literal('ok'), time: t.String() }),
      detail: { summary: 'Sonde de disponibilite' },
    },
  );
}
