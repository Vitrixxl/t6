// Contrat de données du domaine, importe par le client et par l'API.
//
// Tout ce qui s'echange avec le serveur ou se saisit dans un formulaire est
// décrit par un schéma zod dans src/contracts/ ; son type en dérive et se
// réexporte ici pour que le reste du code n'ait qu'un point d'import. Les
// types ci-dessous décrivent les structures internes du moteur et du suivi.
export type {
    GeoPoint,
    MobilityMode,
    MobilityProfile,
    PlannedTrip,
    PlannedTripStatus,
    RecurringTrip,
    RouteInstruction,
    RoutePreselection,
    RoutableMode,
    RoutinePeriod,
    SavedRouteRecord,
    SessionUser,
    TripRecord,
} from './contracts';
import type { GeoPoint, MobilityProfile } from './contracts';

export type {
    Occupancy, GtfsAgency, GtfsStop, GtfsRoute, GtfsTrip,
    GtfsFeed, SharedStation, SharedMobilityFeed, TransportContext, NetworkSources,
} from './contracts/transport';
import type { GtfsFeed, SharedMobilityFeed, NetworkSources } from './contracts/transport';
export type { RouteLeg, LegEstimate, CarbonReference, RouteOption } from './contracts/planning';

export interface TransportNetwork {
    gtfs: GtfsFeed;
    sharedMobility: SharedMobilityFeed | null;
    sources?: NetworkSources;
}

/** Distance et durée réelles d'un couple de points, telles que mesurées par OSRM. */
export interface RouteMeasure {
    distanceMeters: number;
    durationSeconds: number;
}

export interface RouteRequest {
    origin: GeoPoint;
    destination: GeoPoint;
    profile: MobilityProfile;
    network: TransportNetwork;
}

export interface CarbonSummary {
    trips: number;
    totalDistanceKm: number;
    totalCarbonGrams: number;
    totalSavedGrams: number;
    budgetUsagePercent: number;
}

export interface TripActivitySummary {
    doneTotal: number;
    /** Semaine calendaire en cours (depuis lundi). */
    doneThisWeek: number;
    savedThisWeekGrams: number;
    /** Mois calendaire en cours (depuis le 1er). */
    doneThisMonth: number;
    savedThisMonthGrams: number;
    savedTotalGrams: number;
    distanceThisWeekKm: number;
    upcomingCount: number;
    recurringActiveCount: number;
}
