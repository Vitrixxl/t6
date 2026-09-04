// Sonde de disponibilité. Volontairement minimale et non authentifiée : c'est
// elle qu'un orchestrateur ou la CI interroge pour savoir si l'instance est
// prête à recevoir du trafic.
import { Elysia } from 'elysia';
import { z } from 'zod';

export function healthRoutes() {
    return new Elysia({ tags: ['Exploitation'] }).get(
        '/health',
        () => ({ status: 'ok' as const, time: new Date().toISOString() }),
        {
            response: z.object({ status: z.literal('ok'), time: z.string() }),
            detail: { summary: 'Sonde de disponibilité' },
        },
    );
}
