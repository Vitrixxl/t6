// Journal des operations de synchronisation deja appliquees.
//
// C'est ce journal qui rend la file d'attente du client sure : une operation
// dont la reponse s'est perdue peut etre rejouee sans creer de doublon.
import type { Database } from '../db/index.ts';
import { OPERATION_LOG_RETENTION_DAYS } from './limits.ts';

export function createOperationLog(db: Database) {
  return {
    alreadyApplied(userId: string, operationId: string): boolean {
      return db.query('SELECT 1 FROM applied_operations WHERE user_id = ? AND id = ?').get(userId, operationId) !== null;
    },

    record(userId: string, operationId: string, kind: string, appliedAt: string): void {
      db.query('INSERT INTO applied_operations (id, user_id, kind, applied_at) VALUES (?, ?, ?, ?)').run(
        operationId,
        userId,
        kind,
        appliedAt,
      );
    },

    /** Le journal est borne dans le temps, sinon il grossit indefiniment. */
    purgeOlderThan(now: Date): void {
      const cutoff = new Date(now.getTime() - OPERATION_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      db.query('DELETE FROM applied_operations WHERE applied_at <= ?').run(cutoff.toISOString());
    },
  };
}

export type OperationLog = ReturnType<typeof createOperationLog>;
