// Trace de voirie, demande a notre propre API.
//
// Le navigateur n'appelle plus le calculateur d'itineraires directement. Le
// quota d'une instance publique se compte par adresse IP : chaque client
// consommait le meme quota sans que rien ne soit mutualise, et une session de
// test un peu active suffisait a couper le service pour tout le monde (B13).
// L'API interpose un cache partage et rend un contrat fini — trace, distance,
// duree, instructions — que le client n'a plus qu'a consommer.
import type { GeoPoint, MobilityMode, RouteInstruction } from '../../../types';
import { API_BASE } from '../../api/config';
import { withTimeout } from '../http';

export interface RouteGeometry {
  path: GeoPoint[];
  distanceMeters: number;
  durationSeconds: number;
  instructions: RouteInstruction[];
}

interface RouteResponse {
  path: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  instructions: RouteInstruction[];
}

/** Format attendu par l'API : `lon,lat`, une paire par parametre. */
function coordinates(point: Pick<GeoPoint, 'lat' | 'lon'>): string {
  return `${point.lon},${point.lat}`;
}

export async function fetchRouteGeometry(
  mode: MobilityMode,
  origin: GeoPoint,
  destination: GeoPoint,
  signal?: AbortSignal,
): Promise<RouteGeometry | null> {
  const query = new URLSearchParams({ mode, from: coordinates(origin), to: coordinates(destination) });

  try {
    const response = await fetch(`${API_BASE}/route?${query.toString()}`, {
      signal: withTimeout(signal),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RouteResponse;
    if (payload.path.length < 2) {
      return null;
    }

    return {
      path: payload.path.map(([lon, lat], index) => ({
        lon,
        lat,
        label: index === 0 ? origin.label : index === payload.path.length - 1 ? destination.label : 'Trace route',
      })),
      distanceMeters: payload.distanceMeters,
      durationSeconds: payload.durationSeconds,
      instructions: payload.instructions,
    };
  } catch {
    return null;
  }
}
