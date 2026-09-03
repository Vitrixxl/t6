// Gestionnaire d'erreurs unique.
//
// Une erreur de validation devient un 422 lisible ; tout le reste devient un
// 500 opaque : aucune trace technique, aucun detail interne ne fuit vers le
// client (OWASP A09 - journalisation et supervision).
import { Elysia } from 'elysia';

/** Extrait le message le plus parlant d'une erreur de validation TypeBox. */
function firstValidationMessage(error: unknown): string {
    const first = (error as { all?: { summary?: string; message?: string }[] }).all?.[0];
    return first?.message ?? first?.summary ?? 'Requete invalide.';
}

export function errorHandler() {
    return new Elysia({ name: 'error-handler' })
        .onError(({ code, error, status }) => {
            switch (code) {
                case 'VALIDATION':
                    return status(422, { error: firstValidationMessage(error) });
                case 'NOT_FOUND':
                    return status(404, { error: 'Ressource inconnue.' });
                case 'PARSE':
                    return status(400, { error: 'Corps de requete illisible.' });
                default:
                    // Journalise cote serveur, opaque cote client.
                    console.error('erreur non geree', error instanceof Error ? error.message : error);
                    return status(500, { error: 'Erreur interne.' });
            }
        })
        .as('global');
}
