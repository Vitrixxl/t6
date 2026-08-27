// Erreurs de la couche API. Les distinguer par type plutot que par code permet
// aux appelants de decider sans inspecter de chaine de caracteres : une erreur
// metier remonte a l'utilisateur, une panne reseau declenche le repli local.

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

/** Le serveur est injoignable : l'appelant doit retomber sur le mode local. */
export class ApiUnavailableError extends Error {
  constructor() {
    super('Serveur UrbanFlow injoignable.');
    this.name = 'ApiUnavailableError';
  }
}
