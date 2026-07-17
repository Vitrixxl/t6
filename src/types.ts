export type MobilityMode = 'walk' | 'bike' | 'scooter' | 'transit' | 'carpool';

export type Occupancy = 'low' | 'medium' | 'high';

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
  accuracyMeters?: number;
}

export interface MobilityProfile {
  displayName: string;
  preferredModes: MobilityMode[];
  maxWalkMinutes: number;
  accessibilityNeed: boolean;
  avoidRain: boolean;
  carbonGoalGramsPerWeek: number;
}

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  profile: MobilityProfile;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  profile: MobilityProfile;
}

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
}

export interface GtfsRoute {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type: number;
  route_color: string;
  route_text_color: string;
}

export interface GtfsTrip {
  trip_id: string;
  route_id: string;
  service_id: string;
  headway_minutes: number;
  realtime_delay_minutes: number;
  occupancy: Occupancy;
}

export interface TransportIncident {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  affected_modes: MobilityMode[];
  message: string;
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
  incidents: TransportIncident[];
  weather: WeatherSignal;
}

export interface SharedStation {
  station_id: string;
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
  title: string;
  from: string;
  to: string;
  path: GeoPoint[];
  distanceKm: number;
  durationMinutes: number;
  carbonGrams: number;
  accessible: boolean;
  detail: string;
}

export interface RouteInstruction {
  text: string;
  distanceMeters: number;
  detail?: string;
  kind: 'turn' | 'roundabout' | 'depart' | 'arrive' | 'transfer' | 'continue';
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

export interface TripRecord {
  id: string;
  userId: string;
  routeTitle: string;
  modes: MobilityMode[];
  distanceKm: number;
  durationMinutes: number;
  carbonGrams: number;
  carbonSavedGrams: number;
  createdAt: string;
}

export interface SavedRouteRecord {
  id: string;
  userId: string;
  routeId: string;
  routeTitle: string;
  origin: GeoPoint;
  destination: GeoPoint;
  modes: MobilityMode[];
  distanceKm: number;
  durationMinutes: number;
  carbonGrams: number;
  carbonSavedGrams: number;
  score: number;
  createdAt: string;
}

export interface CarbonSummary {
  trips: number;
  totalDistanceKm: number;
  totalCarbonGrams: number;
  totalSavedGrams: number;
  goalUsagePercent: number;
}
