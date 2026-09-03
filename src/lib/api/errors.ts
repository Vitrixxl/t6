// Erreurs de la couche API. Les distinguer par type plutot que par code permet
// aux appelants de decider sans inspecter de chaine de caracteres : une erreur
// metier remonte a l'utilisateur, une panne reseau se signale et l'envoi
// repart avec la prochaine action.

/** Erreur metier renvoyee par le serveur (validation, conflit, session expiree). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Le serveur est injoignable : l'etat en memoire reste affiche, l'envoi sera retente. */
export class ApiUnavailableError extends Error {
  constructor() {
    super('Serveur UrbanFlow injoignable.');
    this.name = 'ApiUnavailableError';
  }
}
