// Générateur d'option : bike.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import type { RouteAccessPlan } from '../access';
import { haversineDistanceKm, stationToPoint } from '../geo';
import { buildOption, createLeg } from '../legs';

export function createBikeOption(
    { origin, destination, profile }: RouteRequest,
    directKm: number,
    access: RouteAccessPlan['bike'],
): RouteOption | null {
    if (!access) {
        return null;
    }
    const fromStation = access.pickup.station;
    const toStation = access.dropoff.station;

    const firstWalkKm = access.pickup.measure.distanceKm;
    const bikeKm = Math.max(haversineDistanceKm(stationToPoint(fromStation), stationToPoint(toStation)) * 1.1, directKm);
    const lastWalkKm = access.dropoff.measure.distanceKm;
    const legs: RouteLeg[] = [
        createLeg({
            id: 'walk-to-bike',
            mode: 'walk',
            title: 'Rejoindre une station vélo',
            from: origin,
            to: stationToPoint(fromStation),
            distanceKm: firstWalkKm,
            accessible: true,
        }),
        {
            ...createLeg({
                id: 'bike-core',
                mode: 'bike',
                title: 'Vélo partagé',
                from: stationToPoint(fromStation),
                to: stationToPoint(toStation),
                distanceKm: bikeKm,
                accessible: !profile.accessibilityNeed,
                // Déverrouillage à la borne et remise en station.
                estimate: { overheadMinutes: 2 },
            }),
            detail: `${fromStation.bikes_available} vélos disponibles au départ, retour autorisé à destination.`,
        },
        createLeg({
            id: 'walk-from-bike',
            mode: 'walk',
            title: 'Fin de trajet',
            from: stationToPoint(toStation),
            to: destination,
            distanceKm: lastWalkKm,
            accessible: true,
        }),
    ];

    return buildOption({
        id: 'bike',
        title: 'Vélo',
        summary: 'Vélo partagé selon les disponibilités des stations proches.',
        modes: ['walk', 'bike'],
        legs,
        reliabilityScore: 86,
        warnings: [],
    });
}
