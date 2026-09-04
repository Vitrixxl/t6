// Erreurs de la couche API. Les distinguer par type plutôt que par code permet
// aux appelants de decider sans inspecter de chaîne de caractères : une erreur
// métier remonte à l'utilisateur, une panne réseau se signale et l'envoi
// repart avec la prochaine action.

/** Erreur métier renvoyée par le serveur (validation, conflit, session expirée). */
export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/** Le serveur est injoignable : l'état en mémoire reste affiche, l'envoi sera retente. */
export class ApiUnavailableError extends Error {
    constructor() {
        super('Serveur UrbanFlow injoignable.');
        this.name = 'ApiUnavailableError';
    }
}
