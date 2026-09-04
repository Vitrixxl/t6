// Bornes de conservation, partagees par les depots, les contrats des
// collections et les operations du client qui elaguent les listes.
//
// Elles servent deux objectifs a la fois : minimisation des donnees
// (RGPD art. 5.1.c) et taille de requete previsible, donc temps de reponse
// previsible. Le client elague avec les memes bornes : une liste qu'il envoie
// n'est jamais refusee pour sa taille.
export const TRIP_HISTORY_LIMIT = 50;
export const SAVED_ROUTES_LIMIT = 50;
export const PLANNED_LIMIT = 400;
export const RECURRING_LIMIT = 50;
