// Bornes de conservation, partagées par les dépôts et les opérations du
// client qui elaguent les vues locales.
//
// Elles servent deux objectifs à la fois : minimisation des données
// (RGPD art. 5.1.c) et taille de requête prévisible, donc temps de réponse
// prévisible. Une écriture granulaire ne transporte jamais la collection.
export const TRIP_HISTORY_LIMIT = 50;
export const SAVED_ROUTES_LIMIT = 50;
export const PLANNED_LIMIT = 400;
export const RECURRING_LIMIT = 50;
