// Routage OSRM : remplace la geometrie approchee du moteur local par le trace
// reel de la voirie, avec distance, duree et instructions.
//
// Limite assumee : OSRM ne route pas le transport public. Une option transit
// utilise donc le profil voirie pour approcher la geometrie entre deux arrets.
import type { GeoPoint, MobilityMode, RouteInstruction } from '../../../types';
import { withTimeout } from '../http';
import { buildInstructions } from './instructions';

export interface OsrmRouteResponse {
  code: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry: {
      type: 'LineString';
      coordinates: [number, number][];
    };
    legs?: Array<{
      steps?: OsrmStep[];
    }>;
  }>;
}

export interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    exit?: number;
  };
}

export async function fetchRouteGeometry(
  mode: MobilityMode,
  origin: GeoPoint,
  destination: GeoPoint,
  signal?: AbortSignal,
): Promise<{ path: GeoPoint[]; distanceMeters: number; durationSeconds: number; instructions: RouteInstruction[] } | null> {
  const endpoint = getOsrmEndpoint(mode);
  const coordinates = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
  const url = `${endpoint}${coordinates}?overview=full&geometries=geojson&steps=true`;

  try {
    const response = await fetch(url, {
      signal: withTimeout(signal),
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as OsrmRouteResponse;
    const route = payload.routes[0];
    if (payload.code !== 'Ok' || !route) {
      return null;
    }

    return {
      path: route.geometry.coordinates.map(([lon, lat], index) => ({
        lon,
        lat,
        label: index === 0 ? origin.label : index === route.geometry.coordinates.length - 1 ? destination.label : 'Trace route',
      })),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      instructions: buildInstructions(route.legs?.flatMap((leg) => leg.steps ?? []) ?? []),
    };
  } catch {
    return null;
  }
}

export function getOsrmEndpoint(mode: MobilityMode): string {
  if (mode === 'walk') {
    return 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
  }
  if (mode === 'bike' || mode === 'scooter') {
    return 'https://routing.openstreetmap.de/routed-bike/route/v1/bike/';
  }
  return 'https://routing.openstreetmap.de/routed-car/route/v1/driving/';
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
