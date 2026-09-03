// Sonde de disponibilite. Volontairement minimale et non authentifiee : c'est
// elle qu'un orchestrateur ou la CI interroge pour savoir si l'instance est
// prete a recevoir du trafic.
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
