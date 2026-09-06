// Recherche d'itinéraire : MOTIS calcule sur le graphe complet (voirie, horaires,
// GBFS) avec les moyens que l'utilisateur a choisis, l'API retient le trajet qui
// arrive le premier et y ajoute la référence carbone.
import type { RouteSearchRequest } from '../../../src/contracts/planning.ts';
import type { AvailableMode, GtfsRoute, RouteOption } from '../../../src/types.ts';
import { applyCarbonReference, createCarbonReference } from '../../../src/lib/planner/emissions.ts';
import type { TransitType } from '../../../src/lib/planner/search-filters.ts';
import { fetchCarMeasure, fetchPlan, type RentalFormFactor, type PlanQuery } from './motis/client.ts';
import { recoverRentalArrival } from './motis/arrival.ts';
import { fastestItinerary, toRouteOption } from './motis/options.ts';

/** Types GTFS retenus par l'utilisateur, dans le vocabulaire MOTIS. */
const TRANSIT_MODE: Record<TransitType, string> = { 0: 'TRAM', 1: 'SUBWAY', 3: 'BUS', 7: 'FUNICULAR' };
/** Engins partagés, dans le vocabulaire GBFS de MOTIS. */
const RENTAL_FORM_FACTOR: Record<Exclude<AvailableMode, 'transit'>, RentalFormFactor> = { bike: 'BICYCLE', scooter: 'SCOOTER_STANDING' };

type RoutingAvailability = { sharedMobility: boolean; transit: boolean; lineShapes?: GtfsRoute[] };

function motisQuery(search: RouteSearchRequest, availability: RoutingAvailability): PlanQuery {
    return {
        from: search.origin,
        to: search.destination,
        departureAt: search.departureAt ?? new Date().toISOString(),
        transitModes: availability.transit && search.modes.includes('transit') ? search.transitTypes.map((type) => TRANSIT_MODE[type]) : [],
        rentalFormFactors: search.accessibilityNeed || !availability.sharedMobility ? [] : search.modes.flatMap((mode) => mode === 'transit' ? [] : [RENTAL_FORM_FACTOR[mode]]),
        wheelchair: search.accessibilityNeed,
    };
}

export async function searchFastestRoute(search: RouteSearchRequest, motisUrl: string, availability: RoutingAvailability, signal?: AbortSignal): Promise<RouteOption | null> {
    signal?.throwIfAborted();
    // La voiture n'est mesurée que comme référence carbone, en parallèle du plan.
    const reference = fetchCarMeasure(motisUrl, search.origin, search.destination, signal).then(createCarbonReference);
    const query = motisQuery(search, availability);
    const initial = await fetchPlan(motisUrl, query, signal);
    const recovered = initial ? await recoverRentalArrival(motisUrl, query, initial, signal) : [];
    const itineraries = [...(initial ?? []), ...recovered];
    signal?.throwIfAborted();

    const allowed = itineraries.filter((itinerary) => itinerary.legs.every((leg) => {
        if (leg.mode === 'WALK') return true;
        if (search.accessibilityNeed && leg.wheelchairAccessible !== 'ACCESSIBLE') return false;
        if (leg.mode === 'RENTAL') return query.rentalFormFactors.some(factor => factor === leg.rental?.formFactor);
        return availability.transit && search.modes.includes('transit') && search.transitTypes.some((type) => TRANSIT_MODE[type] === leg.mode);
    }));
    const fastest = fastestItinerary(allowed);
    const carbonReference = await reference;
    return fastest ? applyCarbonReference(toRouteOption(fastest, { ...search, departureAt: query.departureAt, lineShapes: availability.lineShapes }), carbonReference) : null;
}
