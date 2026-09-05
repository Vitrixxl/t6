// Option composée : un engin partage en rabattement, puis le transport public.
//
// Vélo'v et trottinette suivent exactement le même enchaînement — marche vers
// l'engin, engin jusqu'à la station de montée, ligne(s), derniers mètres a
// pied. Seul change ce qui tient à l'engin : ou le prendre, où l'on a le droit
// de le laisser, combien de temps il coûte a déverrouiller. Le générateur porte
// l'enchaînement, chaque mode ne décrit que sa différence.
import type { MobilityMode, RouteLeg, RouteOption, RouteRequest, SharedStation } from '../../../types';
import type { FeederAccess } from '../access';
import { haversineDistanceKm, stationToPoint, stopToPoint } from '../geo';
import { MODE_LABELS } from '../labels';
import { buildOption, createLeg } from '../legs';
import { transitLegs } from '../transit';

interface Feeder {
    id: 'bike-transit' | 'scooter-transit';
    mode: Extract<MobilityMode, 'bike' | 'scooter'>;
    title: string;
    detail(station: SharedStation): string;
    /** Temps fixe de prise en main : déverrouillage, sortie de borne. */
    unlockMinutes: number;
    /** Fiabilité, puis avec une ligne en retard. */
    reliability: { clear: number; degraded: number };
}

// Les deux modes partagent le parcours ; leurs différences tiennent dans ces valeurs.
const FEEDERS: Record<'bike' | 'scooter', Feeder> = {
    bike: {
        id: 'bike-transit',
        mode: 'bike',
        title: 'Vélo + transport en commun',
        detail: (station) => `${station.bikes_available} vélos disponibles pour rejoindre la correspondance.`,
        // Sortie de borne et remise en station.
        unlockMinutes: 2,
        reliability: { clear: 90, degraded: 78 },
    },
    scooter: {
        id: 'scooter-transit',
        mode: 'scooter',
        title: 'Trottinette + transport en commun',
        detail: (station) => `${station.scooters_available} trottinettes disponibles pour rejoindre la correspondance.`,
        // Déverrouillage par l'application.
        unlockMinutes: 1,
        reliability: { clear: 84, degraded: 72 },
    },
};

export function createFeederTransitOption(
    { origin, destination, profile }: RouteRequest,
    directKm: number,
    mode: 'bike' | 'scooter',
    access: FeederAccess | null,
): RouteOption | null {
    const feeder = FEEDERS[mode];
    const vehicle = MODE_LABELS[mode];
    const Vehicle = vehicle.charAt(0).toUpperCase() + vehicle.slice(1);
    if (!access) {
        return null;
    }
    const fromStation = access.vehicle.station;
    const journey = access.journey;

    const boarding = journey.rides[0].boarding;
    const alighting = journey.rides[journey.rides.length - 1].alighting;
    const feederDestination = access.dropoff ? stationToPoint(access.dropoff.station) : stopToPoint(boarding);

    const firstWalkKm = access.vehicle.measure.distanceKm;
    // Estimation de tri seulement, remplacée par la mesure de la voirie avant
    // affichage : un plancher évite qu'un rabattement quasi nul ne classe
    // l'option devant le transport seul.
    const feederKm = access.dropoff
        ? Math.max(haversineDistanceKm(stationToPoint(fromStation), feederDestination) * 1.2, directKm * 0.22)
        : journey.departureAccess.distanceKm;
    const finalWalkKm = journey.arrivalAccess.distanceKm;
    const delayed = journey.rides.some((ride) => ride.waitMinutes > 4);

    const legs: RouteLeg[] = [
        createLeg({
            id: `${feeder.id}-walk-to-${feeder.mode}`,
            mode: 'walk',
            title: `Approche ${vehicle}`,
            from: origin,
            to: stationToPoint(fromStation),
            distanceKm: firstWalkKm,
            accessible: true,
        }),
        {
            ...createLeg({
                id: `${feeder.id}-feeder`,
                mode: feeder.mode,
                title: `${Vehicle} vers correspondance`,
                from: stationToPoint(fromStation),
                to: feederDestination,
                distanceKm: feederKm,
                accessible: !profile.accessibilityNeed,
                estimate: { overheadMinutes: feeder.unlockMinutes },
            }),
            detail: feeder.detail(fromStation),
        },
        ...(access.dropoff
            ? [
                createLeg({
                    id: `${feeder.id}-walk-to-transit`,
                    mode: 'walk' as const,
                    title: 'Rejoindre la station de transport',
                    from: feederDestination,
                    to: stopToPoint(boarding),
                    distanceKm: access.dropoff.measure.distanceKm,
                    accessible: true,
                }),
            ]
            : []),
        ...transitLegs(journey, feeder.id),
        createLeg({
            id: `${feeder.id}-walk-from-transit`,
            mode: 'walk',
            title: 'Derniers mètres',
            from: stopToPoint(alighting),
            to: destination,
            distanceKm: finalWalkKm,
            accessible: true,
        }),
    ];

    const lines = journey.rides.map((ride) => ride.route.route_short_name).join(' puis ');

    return buildOption({
        id: feeder.id,
        title: feeder.title,
        summary: `${Vehicle} jusqu'à ${boarding.stop_name}, puis ligne ${lines}.`,
        modes: ['walk', feeder.mode, 'transit'],
        legs,
        reliabilityScore: delayed ? feeder.reliability.degraded : feeder.reliability.clear,
        warnings: [],
    });
}
