// Reglages de la couche API, regroupes pour qu'aucune valeur magique ne soit
// dispersee dans les appels.

/** L'API est servie en meme origine (relayee par Vite en developpement) :
 *  le cookie de session reste de premiere partie et aucun CORS n'est requis. */
export const API_BASE = '/api';

/** En mobilite, une requete qui pend est pire qu'une requete qui echoue vite :
 *  le repli local prend alors le relais. Meme delai que les appels aux flux
 *  transport (externalApis.ts). */
export const REQUEST_TIMEOUT_MS = 8000;

/** La sonde de demarrage doit trancher vite : elle retarde le premier ecran. */
export const PROBE_TIMEOUT_MS = 2500;
