// Ouverture d'une session utilisateur : création du jeton, écriture en base et
// pose du cookie. Regroupe ici pour que l'inscription et la connexion posent
// exactement le même cookie, avec exactement les mêmes protections.
import type { ServerConfig } from '../config/index.ts';
import type { SessionRepository } from '../repositories/sessions.ts';
import { createSessionToken, hashToken } from '../security/tokens.ts';

export const SESSION_COOKIE = 'ufm_session';

/** Sous-ensemble du porte-cookies d'Elysia dont ce service a besoin. */
export interface CookieJar {
    [name: string]: { set: (options: Record<string, unknown>) => void } | undefined;
}

export function openSession(
    cookie: CookieJar,
    sessions: SessionRepository,
    config: ServerConfig,
    userId: string,
): void {
    const token = createSessionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.sessionTtlMs);

    sessions.purgeExpired(now.toISOString());
    sessions.create(hashToken(token), userId, now.toISOString(), expiresAt.toISOString());

    cookie[SESSION_COOKIE]?.set({
        value: token,
        httpOnly: true, // inaccessible au JavaScript de page : un XSS ne vole pas la session
        sameSite: 'lax', // pas envoye sur une requête inter-site : protection CSRF
        secure: config.isProduction, // HTTPS obligatoire hors développement local
        path: '/',
        maxAge: Math.floor(config.sessionTtlMs / 1000),
    });
}
