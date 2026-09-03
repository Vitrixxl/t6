// Depot des sessions. Le jeton n'est jamais stocke : seule son empreinte l'est.
import { and, eq, gt, lte } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { sessions } from '../db/schema.ts';

export function createSessionRepository(db: Executor) {
  return {
    create(tokenHash: string, userId: string, createdAt: string, expiresAt: string): void {
      db.insert(sessions).values({ tokenHash, userId, createdAt, expiresAt }).run();
    },

    findValid(tokenHash: string, now: string): { user_id: string } | null {
      const row = db
        .select({ userId: sessions.userId })
        .from(sessions)
        .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
        .get();
      return row ? { user_id: row.userId } : null;
    },

    revoke(tokenHash: string): void {
      db.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).run();
    },

    /** Purge des sessions expirees : la table ne croit pas indefiniment. */
    purgeExpired(now: string): void {
      db.delete(sessions).where(lte(sessions.expiresAt, now)).run();
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
