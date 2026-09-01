// Protocole OSRM : profils, appel, lecture de la reponse.
//
// OSRM prepare un jeu de donnees par profil : marche, velo et voiture ont des
// regles differentes sur les memes rues (sens uniques, escaliers, zones
// pietonnes), et ne peuvent donc pas partager un index. D'ou une base d'URL par
// profil, toutes derivees d'une meme racine configurable.
import type { GeoPoint, MobilityMode, RouteInstruction } from '../../../../src/types.ts';
import { buildInstructions } from './instructions.ts';

const UPSTREAM_TIMEOUT_MS = 8_000;

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

interface OsrmResponse {
  code: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    legs?: Array<{ steps?: OsrmStep[] }>;
  }>;
}

export interface RouteGeometry {
  path: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  instructions: RouteInstruction[];
}

/**
 * Chemin du service pour un mode. Les noms suivent la convention des instances
 * OSRM (`/routed-<profil>/route/v1/<profil>/`), celle qu'utilisent aussi bien
 * l'instance publique que les images officielles auto-hebergees.
 */
export function profilePath(mode: MobilityMode): string {
  if (mode === 'walk') {
    return '/routed-foot/route/v1/foot/';
  }
  if (mode === 'bike' || mode === 'scooter') {
    return '/routed-bike/route/v1/bike/';
  }
  return '/routed-car/route/v1/driving/';
}

export async function fetchUpstreamRoute(
  baseUrl: string,
  mode: MobilityMode,
  from: Pick<GeoPoint, 'lat' | 'lon'>,
  to: Pick<GeoPoint, 'lat' | 'lon'>,
): Promise<RouteGeometry | null> {
  const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = `${baseUrl}${profilePath(mode)}${coordinates}?overview=full&geometries=geojson&steps=true`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as OsrmResponse;
    const route = payload.routes?.[0];
    if (payload.code !== 'Ok' || !route || route.geometry.coordinates.length < 2) {
      return null;
    }

    return {
      path: route.geometry.coordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      instructions: buildInstructions(route.legs?.flatMap((leg) => leg.steps ?? []) ?? []),
    };
  } catch {
    // Indisponibilite, delai depasse, reponse illisible : l'appelant tranchera
    // ce qu'il en dit a l'utilisateur. On ne fabrique pas de trace de repli.
    return null;
  }
}
