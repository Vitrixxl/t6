// Générateur d'option : bike + transit.
import type { RouteOption, RouteRequest } from '../../../types';
import type { RouteAccessPlan } from '../access';
import { createFeederTransitOption, type Feeder } from './feeder-transit';

const bikeFeeder: Feeder = {
    id: 'bike-transit',
    mode: 'bike',
    title: 'Vélo + transport en commun',
    detail: (station) => `${station.bikes_available} vélos disponibles pour rejoindre la correspondance.`,
    // Sortie de borne et remise en station.
    unlockMinutes: 2,
    reliability: { clear: 90, degraded: 78 },
};

export function createBikeTransitOption(
    request: RouteRequest,
    directKm: number,
    access: RouteAccessPlan['bikeTransit'],
): RouteOption | null {
    return createFeederTransitOption(request, directKm, bikeFeeder, access);
}
