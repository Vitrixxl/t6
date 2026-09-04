// Reglages de la couche API, regroupes pour qu'aucune valeur magique ne soit
// dispersee dans les appels.

/** En mobilite, une requete qui pend est pire qu'une requete qui echoue vite :
 *  l'etat en memoire reste affiche et l'envoi repart avec la prochaine action. Meme delai que les
 *  appels aux flux transport (transport/http.ts). */
export const REQUEST_TIMEOUT_MS = 8000;
