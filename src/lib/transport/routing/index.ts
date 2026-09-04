// Routage : géométrie réelle des segments d'un itinéraire.
//
// Une option n'est plus "enrichie" par un appel unique origine -> destination.
// Ce raccourci calculait le trajet entier avec le profil d'un seul mode — la
// voiture pour un trajet finissant en métro — et produisait des mesures qui ne
// correspondaient a aucun des segments affiches (B11). Chaque segment est
// désormais route avec son propre profil, et les mesures de l'option sont la
// somme de celles de ses segments.

export { enhanceLegsWithLiveRouting, hasCompleteGeometry } from './legs';
export { fetchRouteMatrix } from './osrm';
