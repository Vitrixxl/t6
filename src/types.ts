// Contrat de données du domaine, importe par le client et par l'API.
//
// Tout ce qui s'echange avec le serveur ou se saisit dans un formulaire est
// décrit par un schéma zod dans src/contracts/ ; son type en dérive et se
// réexporte ici pour que le reste du code n'ait qu'un point d'import. Les
// types ci-dessous sont ceux qui ne se valident pas : flux transport et
// résultats du moteur d'itinéraires, calculés et jamais reçus d'un tiers.
export type {
    GeoPoint,
    MobilityMode,
    MobilityProfile,
    PlannedTrip,
    PlannedTripStatus,
    RecurringTrip,
    RouteInstruction,
    RouteMatrix,
    RouteMeasure,
    RoutePreselection,
    RoutableMode,
    RoutinePeriod,
    SavedRouteRecord,
    SessionUser,
    TripRecord,
} from './contracts';
import type { GeoPoint, MobilityMode, MobilityProfile, RouteInstruction } from './contracts';

export type Occupancy = 'low' | 'medium' | 'high';

export interface GtfsAgency {
    agency_id: string;
    agency_name: string;
    agency_url: string;
    agency_timezone: string;
}

export interface GtfsStop {
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
    wheelchair_boarding: 0 | 1 | 2;
    /**
     * Lignes desservant cet arrêt, issues du champ `desserte` publié.
     * Un bus conserve son quai physique et ses identifiants de tracés par sens.
     */
    routes: string[];
}

export interface GtfsRoute {
    route_id: string;
    route_short_name: string;
    route_long_name: string;
    route_type: number;
    route_color: string;
    route_text_color: string;
    /**
     * Trace réel de la ligne, en couples `[lon, lat]`, simplifie a 2 m près. Une
     * ligne de métro ne suit pas la voirie : sans ce tracé, le segment ne peut
     * être dessine qu'en approximation routière, ce qui l'envoie ailleurs.
     */
    shape: [number, number][];
    /** Quais ordonnés sur le tracé bus publié ; interdit de le prendre à contresens. */
    stopSequence?: string[];
    /** Accessibilité de la ligne bus publiée, en plus de celle du quai. */
    wheelchairAccessible?: boolean;
}

export interface GtfsTrip {
    trip_id: string;
    route_id: string;
    service_id: string;
    headway_minutes: number;
    realtime_delay_minutes: number;
    occupancy: Occupancy;
}

export interface WeatherSignal {
    condition: 'clear' | 'light_rain' | 'heavy_rain' | 'wind';
    temperature_celsius: number;
    wind_kmh: number;
    updated_at: string;
}

export interface GtfsFeed {
    agency: GtfsAgency;
    stops: GtfsStop[];
    routes: GtfsRoute[];
    trips: GtfsTrip[];
    weather: WeatherSignal;
}

export interface SharedStation {
    station_id: string;
    /**
     * Nature du point : station Vélo'v (ancrage fixe) ou trottinette en flotte
     * libre. Les deux services n'ont ni la même densite ni le même usage, on ne
     * les mélange donc pas dans l'interface.
     */
    kind: 'velov' | 'scooter';
    name: string;
    lat: number;
    lon: number;
    capacity: number;
    bikes_available: number;
    scooters_available: number;
    is_installed: boolean;
    is_renting: boolean;
    is_returning: boolean;
    last_reported: number;
}

export interface SharedMobilityFeed {
    last_updated: number;
    ttl: number;
    version: string;
    data: {
        stations: SharedStation[];
    };
}

export interface NetworkSources {
    gtfs: 'tcl-odbl' | 'local';
    weather: 'open-meteo' | 'local';
}

export interface TransportNetwork {
    gtfs: GtfsFeed;
    sharedMobility: SharedMobilityFeed | null;
    sources?: NetworkSources;
}

export interface RouteLeg {
    id: string;
    mode: MobilityMode;
    /** Correspondance piétonne interne : temps estime, mais aucun tracé invente sans données de station. */
    transfer?: boolean;
    title: string;
    /**
     * Libellé court ecrit sur le tracé de la carte : le nom exact de la ligne
     * ("Métro B", "Tram T1"). Il n'est pose que si la ligne dessert réellement
     * les deux arrêts du segment, vérifie sur la desserte publiée.
     */
    mapLabel?: string;
    /** Couleur officielle de la ligne, pour tracer le segment à ses couleurs. */
    mapColor?: string;
    from: string;
    to: string;
    /** Extrémités du segment. Toujours connues, même sans géométrie. */
    fromPoint: GeoPoint;
    toPoint: GeoPoint;
    /**
     * Géométrie a dessiner. Elle n'est renseignee que par une source réelle : le
     * trace publie d'une ligne de transport, ou la réponse du service de
     * routage. Tant qu'elle est vide, la carte n'affiche rien pour ce segment et
     * l'interface indique un calcul en cours. On ne dessine jamais une
     * approximation : un tracé faux est pire qu'un tracé absent (B14).
     */
    path: GeoPoint[];
    distanceKm: number;
    durationMinutes: number;
    carbonGrams: number;
    accessible: boolean;
    detail: string;
    /**
     * Hypothèses de calcul du segment, conservées a part. Sans elles, remplacer
     * la distance et la durée par celles du réseau routier effacerait l'attente
     * et la congestion, qui ne sont pas du temps de parcours.
     */
    estimate: LegEstimate;
}

export interface LegEstimate {
    /**
     * Multiplicateur du temps de parcours. Le calculateur d'itinéraires raisonne
     * en circulation fluide : il ne connaît pas le trafic. Ce facteur est
     * l'hypothèse de congestion, assumee et affichée comme telle.
     */
    travelFactor: number;
    /** Temps fixe hors parcours : déverrouiller un vélo, attendre une rame, être pris en charge. */
    overheadMinutes: number;
    /** Facteur d'émission retenu pour ce segment, en g/km et **par personne**. */
    carbonGramsPerKm: number;
}

/** Scénario voiture invisible, commun à toutes les options d'une recherche. */
export interface CarbonReference {
    /** Distance du profil OSRM driving entre les extrémités de la recherche. */
    distanceKm: number;
    /** Empreinte de cette distance avec le facteur versionne. */
    carbonGrams: number;
    factorVersion: string;
}

export interface RouteOption {
    id: string;
    title: string;
    summary: string;
    modes: MobilityMode[];
    legs: RouteLeg[];
    path: GeoPoint[];
    distanceKm: number;
    durationMinutes: number;
    carbonGrams: number;
    /** Null quand le profil voiture n'a fourni aucune mesure. */
    carbonSavedGrams: number | null;
    carbonReference: CarbonReference | null;
    reliabilityScore: number;
    score: number;
    accessible: boolean;
    warnings: string[];
    instructions: RouteInstruction[];
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
