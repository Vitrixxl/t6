// Recherche d'itinéraire : MOTIS calcule sur le graphe complet (voirie, horaires,
// GBFS) avec les moyens choisis. L'API classe tous les trajets autorisés par
// arrivée et leur applique la même référence carbone.
import type { RouteSearchRequest } from '../../../src/contracts/planning.ts';
import type { AvailableMode, GtfsRoute, RouteOption } from '../../../src/types.ts';
import { applyCarbonReference, createCarbonReference } from '../../../src/lib/planner/emissions.ts';
import type { TransitType } from '../../../src/lib/planner/search-filters.ts';
import { fetchCarMeasure, fetchPlan, type RentalFormFactor, type PlanQuery } from './motis/client.ts';
import { recoverRentalArrival } from './motis/arrival.ts';
import { fetchTransitCombinations } from './motis/combinations.ts';
import type { MotisItinerary, MotisLeg } from './motis/client.ts';
import { compareItineraries, usableItinerary, toRouteOption } from './motis/options.ts';

/** Types GTFS retenus par l'utilisateur, dans le vocabulaire MOTIS. */
const TRANSIT_MODE: Record<TransitType, string> = { 0: 'TRAM', 1: 'SUBWAY', 3: 'BUS', 7: 'FUNICULAR' };
/** Engins partagés, dans le vocabulaire GBFS de MOTIS. */
const RENTAL_FORM_FACTOR: Record<Exclude<AvailableMode, 'transit'>, RentalFormFactor> = { bike: 'BICYCLE', scooter: 'SCOOTER_STANDING' };

type RoutingAvailability = { sharedMobility: boolean; transit: boolean; lineShapes?: GtfsRoute[] };

function usesRental(rentals: MotisLeg[], factor: RentalFormFactor): boolean {
    return rentals.length > 0 && rentals.every(leg => leg.rental?.formFactor === factor);
}

/** Les accès piétons restent inclus, sans transformer un onglet en un autre moyen. */
function matchesKind(itinerary: MotisItinerary, kind: RouteSearchRequest['kind']): boolean {
    const rentals = itinerary.legs.filter(leg => leg.mode === 'RENTAL');
    const transit = itinerary.legs.some(leg => Object.values(TRANSIT_MODE).includes(leg.mode));
    switch (kind) {
        case 'walk': return itinerary.legs.every(leg => leg.mode === 'WALK');
        case 'bike': return !transit && usesRental(rentals, 'BICYCLE');
        case 'scooter': return !transit && usesRental(rentals, 'SCOOTER_STANDING');
        case 'transit': return transit && rentals.length === 0;
        case 'multimodal': return transit && rentals.length > 0;
        default: return true;
    }
}

async function searchItineraries(motisUrl: string, query: PlanQuery, combined: boolean, signal?: AbortSignal): Promise<MotisItinerary[] | null> {
    if (combined) return fetchTransitCombinations(motisUrl, query, signal);
    const initial = await fetchPlan(motisUrl, query, signal);
    if (!initial) return null;
    const recovered = await recoverRentalArrival(motisUrl, query, initial, signal);
    return [...initial, ...recovered];
}

function motisQuery(search: RouteSearchRequest, availability: RoutingAvailability): PlanQuery {
    return {
        from: search.origin,
        to: search.destination,
        departureAt: search.departureAt ?? new Date().toISOString(),
        transitModes: availability.transit && search.modes.includes('transit') ? search.transitTypes.map((type) => TRANSIT_MODE[type]) : [],
        rentalFormFactors: search.accessibilityNeed || !availability.sharedMobility ? [] : search.modes.flatMap((mode) => mode === 'transit' ? [] : [RENTAL_FORM_FACTOR[mode]]),
        wheelchair: search.accessibilityNeed,
        transitOnly: search.kind === 'transit',
    };
}

export async function searchRouteOptions(search: RouteSearchRequest, motisUrl: string, availability: RoutingAvailability, signal?: AbortSignal): Promise<RouteOption[] | null> {
    signal?.throwIfAborted();
    // La voiture n'est mesurée que comme référence carbone, en parallèle du plan.
    const reference = fetchCarMeasure(motisUrl, search.origin, search.destination, signal).then(createCarbonReference);
    const query = motisQuery(search, availability);
    const itineraries = await searchItineraries(motisUrl, query, search.kind === 'multimodal', signal);
    const carbonReference = await reference;
    signal?.throwIfAborted();
    if (itineraries === null) return null;

    const allowed = itineraries.filter((itinerary) => itinerary.legs.every((leg) => {
        if (leg.mode === 'WALK') return true;
        if (search.accessibilityNeed && leg.wheelchairAccessible !== 'ACCESSIBLE') return false;
        if (leg.mode === 'RENTAL') return query.rentalFormFactors.some(factor => factor === leg.rental?.formFactor);
        return availability.transit && search.modes.includes('transit') && search.transitTypes.some((type) => TRANSIT_MODE[type] === leg.mode);
    }));
    const ordered = allowed.filter(usableItinerary).filter(itinerary => matchesKind(itinerary, search.kind)).sort(compareItineraries);
    const options = ordered.map(itinerary => applyCarbonReference(toRouteOption(itinerary, { ...search, departureAt: query.departureAt, lineShapes: availability.lineShapes }), carbonReference));
    // Un même candidat peut être présent dans plusieurs réponses du moteur.
    // Seuls les doublons exacts disparaissent ; aucune variante n'est tronquée.
    return [...new Map(options.map(option => [option.id, option])).values()];
}
