// Bornes de conservation, partagees par les depots.
//
// Elles servent deux objectifs a la fois : minimisation des donnees
// (RGPD art. 5.1.c) et taille de reponse previsible, donc temps de reponse
// previsible. Les deux premieres sont alignees sur les fenetres du client.
export const TRIP_HISTORY_LIMIT = 50;
export const SAVED_ROUTES_LIMIT = 50;
export const PLANNED_LIMIT = 400;
// Au-dela, un rejeu est de toute facon impossible : la file du client est
// bornee et les operations plus anciennes ont ete remplacees.
export const OPERATION_LOG_RETENTION_DAYS = 30;
