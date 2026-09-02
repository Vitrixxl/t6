// Definition de la semaine calendaire, partagee.
//
// Deux modules agregent sur la semaine — le suivi carbone et les objectifs de
// trajets — et ils doivent s'accorder au jour pres, sans quoi deux ecrans
// annoncent des chiffres differents pour la meme periode. Une seule definition
// evite qu'ils divergent (B16).
//
// La semaine commence le lundi : c'est la convention ISO 8601 et celle du
// calendrier francais, sur laquelle l'utilisateur cale ses habitudes.

/** Lundi 00:00 de la semaine calendaire contenant `now`, en heure locale. */
export function startOfWeek(now: Date): Date {
  const mondayOffset = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
}
