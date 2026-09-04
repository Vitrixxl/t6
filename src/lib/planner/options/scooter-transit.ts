// Generateur d'option : scooter + transit.
import type { RouteOption, RouteRequest } from '../../../types';
import { withinServiceArea } from '../geo';
import { createFeederTransitOption, type Feeder } from './feeder-transit';

const scooterFeeder: Feeder = {
  id: 'scooter-transit',
  mode: 'scooter',
  title: 'Trottinette + transport en commun',
  available: (station) => station.is_renting && station.scooters_available > 0,
  // Flotte libre : pas de borne, mais l'engin doit rester dans la zone de
  // service de l'operateur (B17).
  canDropOff: (_stations, point) => withinServiceArea(point),
  detail: (station) => `${station.scooters_available} trottinettes disponibles pour rejoindre la correspondance.`,
  // Deverrouillage par l'application.
  unlockMinutes: 1,
  reliability: { clear: 84, degraded: 72 },
};

export function createScooterTransitOption(request: RouteRequest, directKm: number): RouteOption | null {
  return createFeederTransitOption(request, directKm, scooterFeeder);
}
