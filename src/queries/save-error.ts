// Ce que l'interface dit d'un envoi refuse. L'information vit dans le cache
// des mutations, pas dans un état a part : le dernier envoi conclu porte son
// résultat, et un succès efface le refus qui l'a précédé.
import { useMutationState, type MutationStatus } from '@tanstack/react-query';
import { mutationKeys } from './keys';

export interface WriteOutcome {
    status: MutationStatus;
    message: string;
    submittedAt: number;
}

/** Le message du dernier envoi conclu s'il a été refuse, sinon rien. */
export function saveErrorFrom(outcomes: WriteOutcome[]): string {
    let latest: WriteOutcome | null = null;
    for (const outcome of outcomes) {
        if (outcome.status !== 'error' && outcome.status !== 'success') {
            continue;
        }
        // A date égale, le plus récent est le dernier enregistre : l'ordre du cache.
        if (!latest || outcome.submittedAt >= latest.submittedAt) {
            latest = outcome;
        }
    }
    return latest?.status === 'error' ? latest.message : '';
}

export function useSaveError(): string {
    const outcomes = useMutationState({
        filters: { mutationKey: mutationKeys.account },
        select: (mutation): WriteOutcome => ({
            status: mutation.state.status,
            message: mutation.state.error?.message ?? '',
            submittedAt: mutation.state.submittedAt,
        }),
    });
    return saveErrorFrom(outcomes);
}
