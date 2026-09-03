// File d'attente de synchronisation (patron "outbox").
//
// L'utilisateur en mobilite perd le reseau au milieu d'un trajet : on ne peut
// pas lui bloquer l'interface le temps d'un aller-retour serveur, ni perdre son
// action. Chaque mutation est donc appliquee immediatement au cache local, puis
// empilee ici. La file est rejouee des que le serveur redevient joignable.
//
// Chaque operation porte un identifiant unique : le serveur ignore celles qu'il
// a deja appliquees, un rejeu apres une reponse perdue ne cree pas de doublon.
import { ApiError, ApiUnavailableError } from './errors';
import { apiRequest } from './http';
import type { OperationPayload } from './operations';

const OUTBOX_KEY = 'ufm.outbox';
// Au-dela, l'utilisateur est hors ligne depuis si longtemps que les operations
// les plus anciennes ont ete remplacees par des plus recentes sur les memes
// objets : on borne pour ne pas saturer le stockage du navigateur.
const OUTBOX_LIMIT = 500;
const BATCH_SIZE = 100;

interface OutboxEntry {
    id: string;
    at: string;
    /** Proprietaire de l'operation : une file en attente ne doit jamais etre
     *  rejouee sous la session d'un autre compte. */
    userId: string;
    payload: OperationPayload;
}

function readOutbox(): OutboxEntry[] {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
    } catch {
        localStorage.removeItem(OUTBOX_KEY);
        return [];
    }
}

function writeOutbox(entries: OutboxEntry[]): void {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries.slice(-OUTBOX_LIMIT)));
}

export function enqueueOperation(userId: string, payload: OperationPayload): void {
    writeOutbox([
        ...readOutbox(),
        { id: crypto.randomUUID(), at: new Date().toISOString(), userId, payload },
    ]);
}

export function pendingOperationCount(userId: string): number {
    return readOutbox().filter((entry) => entry.userId === userId).length;
}

/** Purge la file d'un compte supprime : ses operations n'ont plus d'objet. */
export function discardOperations(userId: string): void {
    writeOutbox(readOutbox().filter((entry) => entry.userId !== userId));
}

export interface FlushResult {
    applied: number;
    ignored: number;
    remaining: number;
}

/**
 * Rejoue la file pour l'utilisateur courant. Ne fait rien si le serveur n'est
 * pas joignable : les operations restent en attente, sans perte.
 */
export async function flushOutbox(userId: string): Promise<FlushResult | null> {
    let applied = 0;
    let ignored = 0;

    // Tant qu'il reste des operations, on envoie par lots bornes : une file
    // accumulee pendant une longue coupure ne produit pas une requete geante.
    for (; ;) {
        const queue = readOutbox();
        const mine = queue.filter((entry) => entry.userId === userId);
        if (mine.length === 0) {
            return { applied, ignored, remaining: 0 };
        }

        const batch = mine.slice(0, BATCH_SIZE);
        try {
            const result = await apiRequest<{ applied: number; ignored: number }>('/state/operations', {
                method: 'POST',
                body: JSON.stringify({
                    operations: batch.map((entry) => ({ id: entry.id, at: entry.at, ...entry.payload })),
                }),
            });
            applied += result.applied;
            ignored += result.ignored;
        } catch (error) {
            if (error instanceof ApiUnavailableError) {
                // Coupure reseau : on garde tout, la prochaine tentative reprendra.
                return { applied, ignored, remaining: readOutbox().filter((e) => e.userId === userId).length };
            }
            if (error instanceof ApiError && error.status === 401) {
                // Session expiree : inutile d'insister, la file attend la reconnexion.
                return { applied, ignored, remaining: mine.length };
            }
            if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
                // Lot refuse par la validation serveur. Le rejouer indefiniment
                // bloquerait toute la file derriere lui : on l'ecarte et on le signale.
                const sent = new Set(batch.map((entry) => entry.id));
                writeOutbox(queue.filter((entry) => !sent.has(entry.id)));
                console.error('Operations de synchronisation refusees par le serveur, ecartees.', error.message);
                continue;
            }
            throw error;
        }

        const sent = new Set(batch.map((entry) => entry.id));
        writeOutbox(readOutbox().filter((entry) => !sent.has(entry.id)));
    }
}
