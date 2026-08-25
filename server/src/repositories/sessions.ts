// Depot des sessions. Le jeton n'est jamais stocke : seule son empreinte l'est.
import type { Database } from '../db/index.ts';

export function createSessionRepository(db: Database) {
  return {
    create(tokenHash: string, userId: string, createdAt: string, expiresAt: string): void {
      db.query('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
        tokenHash,
        userId,
        createdAt,
        expiresAt,
      );
    },

    findValid(tokenHash: string, now: string): { user_id: string } | null {
      return db.query('SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash, now) as
        | { user_id: string }
        | null;
    },

    revoke(tokenHash: string): void {
      db.query('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    },

    /** Purge des sessions expirees : la table ne croit pas indefiniment. */
    purgeExpired(now: string): void {
      db.query('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
