// Journal des operations de synchronisation deja appliquees.
//
// C'est ce journal qui rend la file d'attente du client sure : une operation
// dont la reponse s'est perdue peut etre rejouee sans creer de doublon.
import { and, eq, lte, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { appliedOperations } from '../db/schema.ts';
import { OPERATION_LOG_RETENTION_DAYS } from './limits.ts';

export function createOperationLog(db: Executor) {
  return {
    alreadyApplied(userId: string, operationId: string): boolean {
      const row = db
        .select({ one: sql<number>`1` })
        .from(appliedOperations)
        .where(and(eq(appliedOperations.userId, userId), eq(appliedOperations.id, operationId)))
        .get();
      return row !== undefined;
    },

    record(userId: string, operationId: string, kind: string, appliedAt: string): void {
      db.insert(appliedOperations).values({ id: operationId, userId, kind, appliedAt }).run();
    },

    /** Le journal est borne dans le temps, sinon il grossit indefiniment. */
    purgeOlderThan(now: Date): void {
      const cutoff = new Date(now.getTime() - OPERATION_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      db.delete(appliedOperations).where(lte(appliedOperations.appliedAt, cutoff.toISOString())).run();
    },
  };
}

export type OperationLog = ReturnType<typeof createOperationLog>;
