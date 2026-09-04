// Définition de la semaine calendaire, partagée.
//
// Deux modules agregent sur la semaine — le suivi carbone et les objectifs de
// trajets — et ils doivent s'accorder au jour près, sans quoi deux écrans
// annoncent des chiffres différents pour la même période. Une seule définition
// évite qu'ils divergent (B16).
//
// La semaine commence le lundi : c'est la convention ISO 8601 et celle du
// calendrier français, sur laquelle l'utilisateur cale ses habitudes.

/** Lundi 00:00 de la semaine calendaire contenant `now`, en heure locale. */
export function startOfWeek(now: Date): Date {
    const mondayOffset = (now.getDay() + 6) % 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
}
