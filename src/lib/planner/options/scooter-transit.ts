// Générateur d'option : scooter + transit.
import type { RouteOption, RouteRequest } from '../../../types';
import type { RouteAccessPlan } from '../access';
import { createFeederTransitOption, type Feeder } from './feeder-transit';

const scooterFeeder: Feeder = {
    id: 'scooter-transit',
    mode: 'scooter',
    title: 'Trottinette + transport en commun',
    detail: (station) => `${station.scooters_available} trottinettes disponibles pour rejoindre la correspondance.`,
    // Déverrouillage par l'application.
    unlockMinutes: 1,
    reliability: { clear: 84, degraded: 72 },
};

export function createScooterTransitOption(
    request: RouteRequest,
    directKm: number,
    access: RouteAccessPlan['scooterTransit'],
): RouteOption | null {
    return createFeederTransitOption(request, directKm, scooterFeeder, access);
}
