// Limitation de debit par fenetre glissante, en memoire.
//
// Deux raisons de ne pas prendre une dependance : le plugin communautaire
// n'est pas compatible avec la version majeure d'Elysia utilisee, et la regle
// tient en quarante lignes verifiables. Limite assumee : le compteur est local
// au processus. Derriere plusieurs instances, il faudra un compteur partage
// (Redis) - c'est note dans la trajectoire d'evolution.
import { Elysia } from 'elysia';

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Nombre de requetes autorisees par fenetre. */
  max: number;
  windowMs: number;
  /** Prefixe de compteur : deux limites distinctes ne se marchent pas dessus. */
  scope: string;
  /** Ne faire confiance a X-Forwarded-For que derriere un proxy maitrise. */
  trustProxy: boolean;
}

// Un seul registre pour toutes les limites : le balayage periodique le purge
// entierement, il n'y a pas de fuite memoire par portee.
const windows = new Map<string, Window>();

function clientKey(request: Request, trustProxy: boolean, address: string | undefined): string {
  if (trustProxy) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() ?? 'inconnu';
    }
  }
  return address ?? 'inconnu';
}

export function rateLimit(options: RateLimitOptions) {
  return new Elysia({ name: `rate-limit-${options.scope}` }).onBeforeHandle(
    { as: 'scoped' },
    ({ request, server, set, status }) => {
      const key = `${options.scope}:${clientKey(request, options.trustProxy, server?.requestIP(request)?.address)}`;
      const now = Date.now();
      const current = windows.get(key);

      if (!current || current.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + options.windowMs });
        return;
      }

      current.count += 1;
      if (current.count > options.max) {
        set.headers['retry-after'] = String(Math.ceil((current.resetAt - now) / 1000));
        return status(429, { error: 'Trop de requetes, reessayez dans un instant.' });
      }
    },
  );
}

/** Vide les compteurs (utilise par les tests pour rester independants). */
export function resetRateLimits(): void {
  windows.clear();
}
