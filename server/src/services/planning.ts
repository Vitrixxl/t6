// Recherche d'itinéraires : MOTIS calcule sur le graphe complet (voirie, horaires,
// GBFS), l'API en garde une lecture par famille et y ajoute la référence carbone.
import type { RouteSearchRequest } from '../../../src/contracts/planning.ts';
import type { RouteOption } from '../../../src/types.ts';
import { applyCarbonReference, createCarbonReference, rankRoutes } from '../../../src/lib/planner/index.ts';
import type { TransitType } from '../../../src/lib/planner/transit-filter.ts';
import { fetchCarMeasure, fetchPlan, type MotisAccess } from './motis/client.ts';
import { selectOptions } from './motis/options.ts';

/** Types GTFS retenus par l'utilisateur, dans le vocabulaire MOTIS. */
const TRANSIT_MODE: Record<TransitType, string> = { 0: 'TRAM', 1: 'SUBWAY', 3: 'BUS', 7: 'FUNICULAR' };

export async function searchRoutes(search: RouteSearchRequest, motisUrl: string, signal?: AbortSignal): Promise<RouteOption[]> {
    signal?.throwIfAborted();
    const query = {
        from: search.origin,
        to: search.destination,
        departureAt: search.departureAt ?? new Date().toISOString(),
        transitModes: search.transitTypes.map((type) => TRANSIT_MODE[type]),
        wheelchair: search.profile.accessibilityNeed,
    };
    // Un trajet par moyen d'accès : à pied, puis en vélo et en trottinette
    // partagés quand les flux sont disponibles. La voiture n'est mesurée que
    // comme référence carbone.
    const accesses: MotisAccess[] = ['WALK', ...(search.sharedMobilityAvailable ? (['BICYCLE', 'SCOOTER_STANDING'] as const) : [])];
    const reference = fetchCarMeasure(motisUrl, search.origin, search.destination, signal).then(createCarbonReference);
    const plans = await Promise.all(accesses.map((access) => fetchPlan(motisUrl, { ...query, access }, signal)));
    signal?.throwIfAborted();

    const itineraries = plans.flatMap((plan) => plan ?? []);
    const options = selectOptions(itineraries, search);
    return applyCarbonReference(rankRoutes(options, search.profile), await reference);
}
