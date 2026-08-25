// Cache des alertes trafic TCL (SIRI Situation Exchange, data.grandlyon.com).
//
// La logique de cache est ici, hors de la route : elle a son propre etat, ses
// propres regles de fraicheur, et se teste sans requete HTTP.
//
// Deux raisons de relayer la source plutot que de l'appeler depuis le
// navigateur : les identifiants du compte Grand Lyon restent cote serveur, et
// un cache partage evite que chaque client martele la source (eco-conception,
// et respect du quota du fournisseur).
import type { ServerConfig } from '../config/index.ts';

const UPSTREAM_URL =
  'https://download.data.grandlyon.com/ws/rdata/tcl_sytral.tclalertetrafic_2/all.json?maxfeatures=200';
const MIN_UPSTREAM_INTERVAL_MS = 30_000;
const UPSTREAM_TIMEOUT_MS = 10_000;

export interface AlertsSnapshot {
  body: string;
  status: number;
  fetchedAt: number;
  changedAt: number;
}

export function createTransitAlerts(config: ServerConfig) {
  const authorization = config.grandLyonLogin
    ? `Basic ${Buffer.from(`${config.grandLyonLogin}:${config.grandLyonPassword}`).toString('base64')}`
    : null;

  const cache = { body: null as string | null, status: 503, fetchedAt: 0, changedAt: 0 };
  let inflight: Promise<void> | null = null;

  async function refresh(): Promise<void> {
    try {
      const response = await fetch(UPSTREAM_URL, {
        headers: authorization
          ? { Authorization: authorization, Accept: 'application/json' }
          : { Accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      const body = await response.text();

      if (response.ok) {
        if (body !== cache.body) {
          cache.body = body;
          cache.changedAt = Date.now();
        }
        cache.status = 200;
      } else if (cache.status !== 200) {
        // Pas encore de donnee valide en cache : on relaie l'erreur amont.
        cache.body = body;
        cache.status = response.status;
      }
      // Amont en erreur mais cache valide : on continue de servir le cache.
    } catch {
      if (cache.status !== 200) {
        cache.body = JSON.stringify({ detail: 'Flux alertes TCL injoignable.' });
        cache.status = 503;
      }
    } finally {
      cache.fetchedAt = Date.now();
    }
  }

  return {
    async snapshot(): Promise<AlertsSnapshot> {
      if (Date.now() - cache.fetchedAt >= MIN_UPSTREAM_INTERVAL_MS) {
        // Une seule requete amont a la fois, quel que soit le nombre de clients.
        inflight ??= refresh().finally(() => {
          inflight = null;
        });
      }
      if (inflight) {
        await inflight;
      }

      return {
        body: cache.body ?? JSON.stringify({ detail: 'Flux alertes TCL indisponible.' }),
        status: cache.status,
        fetchedAt: cache.fetchedAt,
        changedAt: cache.changedAt,
      };
    },
  };
}
