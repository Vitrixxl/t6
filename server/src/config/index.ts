// Configuration du serveur. Toute variable d'environnement est lue et validée
// ici, une seule fois : une valeur absurde arrête le processus au démarrage
// plutôt que de produire une panne obscure en pleine requête.

export interface ServerConfig {
    /** ':memory:' en test, fichier SQLite sinon. */
    databasePath: string;
    port: number;
    host: string;
    isProduction: boolean;
    /** Durée de vie d'une session (cookie + ligne en base). */
    sessionTtlMs: number;
    /**
     * À n'activer que derrière un proxy de confiance qui réécrit
     * X-Forwarded-For : sinon n'importe quel client peut usurper son adresse et
     * contourner la limitation de débit.
     */
    trustProxy: boolean;
    /**
     * Adresse du moteur d'itinéraires MOTIS. Par défaut, le nom du service
     * Docker ; hors conteneur, son adresse loopback (voir README).
     */
    motisUrl: string;
    /** Activé uniquement après import d’une archive GTFS courante. */
    motisTransitEnabled: boolean;
    /**
     * Dossier du client construit, servi par l'API elle-même. Une seule origine
     * pour l'application et son API : cookie de première partie, aucun CORS.
     */
    webRoot: string;
    /**
     * Certificat et clé TLS. Renseignés, le serveur écoute en HTTPS.
     *
     * Le chiffrement n'est pas qu'une précaution : le navigateur réserve au
     * contexte sécurisé la géolocalisation, `crypto.randomUUID` et le service
     * worker. Sans HTTPS, l'application est inutilisable ailleurs que sur
     * localhost — depuis un téléphone du réseau local, par exemple.
     */
    tlsCertPath: string;
    tlsKeyPath: string;
}

/**
 * Une variable absente et une variable vide sont la même chose : `.env.example`
 * liste les clés avec une valeur vide, et les copier ne doit pas écraser la
 * valeur par défaut par une chaîne vide.
 */
function text(raw: string | undefined, fallback: string): string {
    return raw === undefined || raw.trim() === '' ? fallback : raw.trim();
}

function positiveInteger(name: string, raw: string | undefined, fallback: number): number {
    if (raw === undefined || raw === '') {
        return fallback;
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} doit être un entier positif (reçu : ${raw}).`);
    }
    return value;
}

export function loadConfig(env: Record<string, string | undefined> = Bun.env): ServerConfig {
    return {
        databasePath: text(env.DATABASE_PATH, 'server/data/urbanflow.db'),
        port: positiveInteger('API_PORT', env.API_PORT, 4000),
        host: text(env.API_HOST, '127.0.0.1'),
        isProduction: env.NODE_ENV === 'production',
        sessionTtlMs: positiveInteger('SESSION_TTL_MS', env.SESSION_TTL_MS, 7 * 24 * 60 * 60 * 1000),
        trustProxy: env.TRUST_PROXY === 'true',
        webRoot: text(env.WEB_ROOT, 'dist'),
        tlsCertPath: text(env.TLS_CERT_PATH, ''),
        tlsKeyPath: text(env.TLS_KEY_PATH, ''),
        motisTransitEnabled: env.MOTIS_TRANSIT_ENABLED === 'true',
        motisUrl: text(env.MOTIS_URL, 'http://motis:8080').replace(/\/+$/, ''),
    };
}
