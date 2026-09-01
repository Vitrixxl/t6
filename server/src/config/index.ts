// Configuration du serveur. Toute variable d'environnement est lue et validee
// ici, une seule fois : une valeur absurde arrete le processus au demarrage
// plutot que de produire une panne obscure en pleine requete.

export interface ServerConfig {
  /** ':memory:' en test, fichier SQLite sinon. */
  databasePath: string;
  port: number;
  host: string;
  isProduction: boolean;
  /** Duree de vie d'une session (cookie + ligne en base). */
  sessionTtlMs: number;
  /**
   * A n'activer que derriere un proxy de confiance qui reecrit
   * X-Forwarded-For : sinon n'importe quel client peut usurper son adresse et
   * contourner la limitation de debit.
   */
  trustProxy: boolean;
  /** Identifiants data.grandlyon.com pour les alertes TCL (jamais exposes au client). */
  grandLyonLogin: string;
  grandLyonPassword: string;
  /**
   * Base du service de routage. Par defaut l'instance publique de
   * demonstration d'OpenStreetMap : elle depanne, mais elle n'a aucun
   * engagement de service et limite par adresse IP (B13). Pointer cette
   * variable sur une instance OSRM locale supprime toute dependance tierce a
   * l'execution — voir le README.
   */
  osrmBaseUrl: string;
  /**
   * Duree de validite d'un trace en cache. La voirie ne bouge pas d'un jour a
   * l'autre : une journee evite de redemander mille fois le meme trajet sans
   * risquer de servir une geometrie obsolete.
   */
  routeCacheTtlMs: number;
}

function positiveInteger(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} doit etre un entier positif (recu : ${raw}).`);
  }
  return value;
}

export function loadConfig(env: Record<string, string | undefined> = Bun.env): ServerConfig {
  return {
    databasePath: env.DATABASE_PATH ?? 'server/data/urbanflow.db',
    port: positiveInteger('API_PORT', env.API_PORT, 4000),
    host: env.API_HOST ?? '127.0.0.1',
    isProduction: env.NODE_ENV === 'production',
    sessionTtlMs: positiveInteger('SESSION_TTL_MS', env.SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000),
    trustProxy: env.TRUST_PROXY === 'true',
    grandLyonLogin: env.GRANDLYON_LOGIN ?? '',
    grandLyonPassword: env.GRANDLYON_PASSWORD ?? '',
    osrmBaseUrl: (env.OSRM_BASE_URL ?? 'https://routing.openstreetmap.de').replace(/\/+$/, ''),
    routeCacheTtlMs: positiveInteger('ROUTE_CACHE_TTL_MS', env.ROUTE_CACHE_TTL_MS, 24 * 60 * 60 * 1000),
  };
}
