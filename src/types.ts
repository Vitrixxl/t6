// Contrat de donnees du domaine, importe par le client et par l'API.
//
// Tout ce qui s'echange avec le serveur ou se saisit dans un formulaire est
// decrit par un schema zod dans src/contracts/ ; son type en derive et se
// reexporte ici pour que le reste du code n'ait qu'un point d'import. Les
// types ci-dessous sont ceux qui ne se valident pas : flux transport et
// resultats du moteur d'itineraires, calcules et jamais recus d'un tiers.
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
   * Lignes structurantes desservant l'arret (`['B', 'T1']`), issues du champ
   * `desserte` du portail open data. Vide pour un arret uniquement bus : le
   * moteur d'itineraires ne peut alors pas y faire monter le voyageur.
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
   * Trace reel de la ligne, en couples `[lon, lat]`, simplifie a 2 m pres. Une
   * ligne de metro ne suit pas la voirie : sans ce trace, le segment ne peut
   * etre dessine qu'en approximation routiere, ce qui l'envoie ailleurs.
   */
  shape: [number, number][];
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
   * Nature du point : station Velo'v (ancrage fixe) ou trottinette en flotte
   * libre. Les deux services n'ont ni la meme densite ni le meme usage, on ne
   * les melange donc pas dans l'interface.
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
  sharedMobility: 'gbfs-live' | 'local';
  weather: 'open-meteo' | 'local';
}

export interface TransportNetwork {
  gtfs: GtfsFeed;
  sharedMobility: SharedMobilityFeed;
  sources?: NetworkSources;
}

export interface RouteLeg {
  id: string;
  mode: MobilityMode;
  /** Correspondance pietonne interne : temps estime, mais aucun trace invente sans donnees de station. */
  transfer?: boolean;
  title: string;
  /**
   * Libelle court ecrit sur le trace de la carte : le nom exact de la ligne
   * ("Metro B", "Tram T1"). Il n'est pose que si la ligne dessert reellement
   * les deux arrets du segment, verifie sur la desserte publiee.
   */
  mapLabel?: string;
  /** Couleur officielle de la ligne, pour tracer le segment a ses couleurs. */
  mapColor?: string;
  from: string;
  to: string;
  /** Extremites du segment. Toujours connues, meme sans geometrie. */
  fromPoint: GeoPoint;
  toPoint: GeoPoint;
  /**
   * Geometrie a dessiner. Elle n'est renseignee que par une source reelle : le
   * trace publie d'une ligne de transport, ou la reponse du service de
   * routage. Tant qu'elle est vide, la carte n'affiche rien pour ce segment et
   * l'interface indique un calcul en cours. On ne dessine jamais une
   * approximation : un trace faux est pire qu'un trace absent (B14).
   */
  path: GeoPoint[];
  distanceKm: number;
  durationMinutes: number;
  carbonGrams: number;
  accessible: boolean;
  detail: string;
  /**
   * Hypotheses de calcul du segment, conservees a part. Sans elles, remplacer
   * la distance et la duree par celles du reseau routier effacerait l'attente
   * et la congestion, qui ne sont pas du temps de parcours.
   */
  estimate: LegEstimate;
}

export interface LegEstimate {
  /**
   * Multiplicateur du temps de parcours. Le calculateur d'itineraires raisonne
   * en circulation fluide : il ne connait pas le trafic. Ce facteur est
   * l'hypothese de congestion, assumee et affichee comme telle.
   */
  travelFactor: number;
  /** Temps fixe hors parcours : deverrouiller un velo, attendre une rame, etre pris en charge. */
  overheadMinutes: number;
  /** Facteur d'emission retenu pour ce segment, en g/km et **par personne**. */
  carbonGramsPerKm: number;
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
  carbonSavedGrams: number;
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
  goalUsagePercent: number;
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
