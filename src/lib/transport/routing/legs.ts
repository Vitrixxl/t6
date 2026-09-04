// Géométrie réelle segment par segment.
//
// Chaque segment est route avec le profil qui lui correspond : le segment
// piéton suit les trottoirs, le segment vélo les pistes cyclables. Le coût est
// borne — on n'enrichit que l'itinéraire selectionne, soit trois a quatre
// appels, et seulement quand la sélection change.
//
// Toutes les options candidates sont mesurées avant affichage. Le cache partagé
// absorbe les segments identiques entre options et utilisateurs.
//
// Un segment dont le routage ne répond pas ressort **sans géométrie**. C'est
// deliberé : l'interface affichera un calcul en cours ou une indisponibilité,
// jamais une ligne inventée. Un tracé faux se lit comme un itinéraire réel et
// envoie l'utilisateur ailleurs (B14).
import type { RouteLeg } from '../../../types';
import { legDuration } from '../../planner/legs';
import { round } from '../../planner/metrics';
import { fetchRouteGeometry } from './osrm';

export async function enhanceLegsWithLiveRouting(legs: RouteLeg[], signal?: AbortSignal): Promise<RouteLeg[]> {
    return Promise.all(
        legs.map(async (leg) => {
            // Un segment de transport public porte déjà le tracé réel de la ligne,
            // decoupe entre les deux stations. OSRM ne route pas le rail : le lui
            // demander renvoyait un itinéraire *routier* entre les deux stations, ce
            // qui dessinait le métro sur les quais et les sens uniques (B12).
            if (leg.mode === 'transit' || leg.transfer) {
                return leg;
            }

            const geometry = await fetchRouteGeometry(leg.mode, leg.fromPoint, leg.toPoint, signal);
            if (!geometry || geometry.path.length < 2) {
                return { ...leg, path: [] };
            }

            // La distance et la durée du réseau routier remplacent l'estimation a vol
            // d'oiseau. Les hypothèses du segment sont conservées : la congestion
            // ajuste le temps de parcours, et l'attente ou la prise en charge s'y
            // ajoutent — ce ne sont pas du trajet, le routage ne les connaît pas.
            const distanceKm = round(geometry.distanceMeters / 1000, 2);

            return {
                ...leg,
                path: geometry.path,
                distanceKm,
                durationMinutes: legDuration(geometry.durationSeconds / 60, leg.estimate),
                carbonGrams: Math.round(distanceKm * leg.estimate.carbonGramsPerKm),
            };
        }),
    );
}

/** Un itinéraire est prêt a être dessine quand tous ses segments ont un tracé. */
export function hasCompleteGeometry(legs: RouteLeg[]): boolean {
    return legs.length > 0 && legs.every((leg) => leg.transfer || leg.path.length >= 2);
}
