// Reglages de la couche API, regroupés pour qu'aucune valeur magique ne soit
// dispersée dans les appels.

/** En mobilité, une requête qui pend est pire qu'une requête qui echoue vite :
 *  l'état en mémoire reste affiche et l'envoi repart avec la prochaine action. Même délai que les
 *  appels aux flux transport (transport/http.ts). */
export const REQUEST_TIMEOUT_MS = 8000;
