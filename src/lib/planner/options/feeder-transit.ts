// Option composee : un engin partage en rabattement, puis le transport public.
//
// Velo'v et trottinette suivent exactement le meme enchainement — marche vers
// l'engin, engin jusqu'a la station de montee, ligne(s), derniers metres a
// pied. Seul change ce qui tient a l'engin : ou le prendre, ou l'on a le droit
// de le laisser, combien de temps il coute a deverrouiller. Le generateur porte
// l'enchainement, chaque mode ne decrit que sa difference.
import type { MobilityMode, RouteLeg, RouteOption, RouteRequest, SharedStation } from '../../../types';
import type { FeederAccess } from '../access';
import { haversineDistanceKm, stationToPoint, stopToPoint } from '../geo';
import { MODE_LABELS } from '../labels';
import { buildOption, createLeg } from '../legs';
import { transitLegs } from '../transit';

export interface Feeder {
    id: 'bike-transit' | 'scooter-transit';
    mode: Extract<MobilityMode, 'bike' | 'scooter'>;
    title: string;
    detail(station: SharedStation): string;
    /** Temps fixe de prise en main : deverrouillage, sortie de borne. */
    unlockMinutes: number;
    /** Fiabilite par temps sec, puis sous la pluie ou avec une ligne en retard. */
    reliability: { clear: number; degraded: number };
}

export function createFeederTransitOption(
    { origin, destination, profile, network }: RouteRequest,
    directKm: number,
    feeder: Feeder,
    access: FeederAccess | null,
): RouteOption | null {
    const vehicle = MODE_LABELS[feeder.mode];
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
    // Estimation de tri seulement, remplacee par la mesure de la voirie avant
    // affichage : un plancher evite qu'un rabattement quasi nul ne classe
    // l'option devant le transport seul.
    const feederKm = access.dropoff
        ? Math.max(haversineDistanceKm(stationToPoint(fromStation), feederDestination) * 1.2, directKm * 0.22)
        : journey.departureAccess.distanceKm;
    const finalWalkKm = journey.arrivalAccess.distanceKm;
    const rainWarning = network.gtfs.weather.condition.includes('rain');
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
            title: 'Derniers metres',
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
        summary: `${Vehicle} jusqu'a ${boarding.stop_name}, puis ligne ${lines}.`,
        modes: ['walk', feeder.mode, 'transit'],
        legs,
        reliabilityScore: delayed || rainWarning ? feeder.reliability.degraded : feeder.reliability.clear,
        // RG4 : l'engin est a l'air libre, la pluie s'applique a la portion de rabattement.
        warnings: rainWarning && profile.avoidRain ? [`Pluie legere detectee sur la portion ${vehicle}.`] : [],
    });
}
