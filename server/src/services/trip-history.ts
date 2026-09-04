// L'historique s'alimente par la completion d'un trajet. Sa seule commande
// publique propre est l'effacement explicite demande par l'utilisateur.
import type { Db } from '../db/index.ts';
import { createRepositories } from '../repositories/index.ts';

export function clearTripHistory(db: Db, userId: string): void {
  createRepositories(db).tripRecords.clear(userId);
}
