// Generateur d'option : bike + transit.
import type { RouteOption, RouteRequest, SharedStation } from '../../../types';
import { nearestStation } from '../geo';
import { createFeederTransitOption, type Feeder } from './feeder-transit';

const rentable = (station: SharedStation) =>
  station.is_installed && station.is_renting && station.is_returning && station.bikes_available > 0;

const bikeFeeder: Feeder = {
  id: 'bike-transit',
  mode: 'bike',
  title: 'Velo + transport en commun',
  available: rentable,
  // RG3 aux deux bouts : le Velo'v se rend a une borne, il en faut une a
  // portee de marche de la station de montee.
  canDropOff: (stations, point) =>
    nearestStation(stations.filter((station) => station.is_installed && station.is_returning), point) !== null,
  detail: (station) => `${station.bikes_available} velos disponibles pour rejoindre la correspondance.`,
  // Sortie de borne et remise en station.
  unlockMinutes: 2,
  reliability: { clear: 90, degraded: 78 },
};

export function createBikeTransitOption(request: RouteRequest, directKm: number): RouteOption | null {
  return createFeederTransitOption(request, directKm, bikeFeeder);
}
