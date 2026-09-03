// Reglages de la couche API, regroupes pour qu'aucune valeur magique ne soit
// dispersee dans les appels.

/** L'API est servie en meme origine que le client : le cookie de session
 *  reste de premiere partie et aucun CORS n'est requis. */
export const API_BASE = '/api';

/** En mobilite, une requete qui pend est pire qu'une requete qui echoue vite :
 *  l'etat local reste affiche et l'envoi sera retente. Meme delai que les
 *  appels aux flux transport (transport/http.ts). */
export const REQUEST_TIMEOUT_MS = 8000;
