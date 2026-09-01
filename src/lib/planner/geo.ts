// Calculs spatiaux : distances et recherche du point d'acces au reseau le plus
// proche.
import type { GeoPoint, GtfsStop, SharedStation } from '../../types';
import { MAX_STATION_ACCESS_KM } from './constants';

export function haversineDistanceKm(a: Pick<GeoPoint, 'lat' | 'lon'>, b: Pick<GeoPoint, 'lat' | 'lon'>): number {
  const radiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const value =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * radiusKm * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

// RG3 : seule une station situee dans le rayon de marche (400 m) est exploitable.
export function nearestStation(stations: SharedStation[], point: GeoPoint): SharedStation | null {
  if (stations.length === 0) {
    return null;
  }

  const closest = stations
    .slice()
    .sort((a, b) => haversineDistanceKm(stationToPoint(a), point) - haversineDistanceKm(stationToPoint(b), point))[0];

  return haversineDistanceKm(stationToPoint(closest), point) <= MAX_STATION_ACCESS_KM ? closest : null;
}

export function stopToPoint(stop: GtfsStop): GeoPoint {
  return {
    label: stop.stop_name,
    lat: stop.stop_lat,
    lon: stop.stop_lon,
  };
}

export function stationToPoint(station: SharedStation): GeoPoint {
  return {
    label: station.name,
    lat: station.lat,
    lon: station.lon,
  };
}
