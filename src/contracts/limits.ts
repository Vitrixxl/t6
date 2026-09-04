// Bornes de conservation, partagees par les depots et les operations du
// client qui elaguent les vues locales.
//
// Elles servent deux objectifs a la fois : minimisation des donnees
// (RGPD art. 5.1.c) et taille de requete previsible, donc temps de reponse
// previsible. Une ecriture granulaire ne transporte jamais la collection.
export const TRIP_HISTORY_LIMIT = 50;
export const SAVED_ROUTES_LIMIT = 50;
export const PLANNED_LIMIT = 400;
export const RECURRING_LIMIT = 50;
