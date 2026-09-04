// Construction des segments et assemblage d'une option à partir de ses
// segments : distance, durée, carbone et accessibilité sont derives des
// segments, jamais saisis en double.
import type { GeoPoint, LegEstimate, MobilityMode, RouteInstruction, RouteLeg, RouteOption } from '../../types';
import { SPEED_KMH } from './constants';
import { ROAD_EMISSION_FACTORS } from './emissions';
import { MODE_LABELS } from './labels';
import { minutesForDistance, round } from './metrics';

/**
 * Description d'un segment. Les extrémités sont des points, pas des libellés :
 * le routage a besoin des coordonnées, et l'interface tire le libellé du point.
 */
interface CommonLegInput {
    id: string;
    title: string;
    from: GeoPoint;
    to: GeoPoint;
    distanceKm: number;
    accessible: boolean;
    /**
     * Géométrie réelle, quand la source en publie une — c'est le cas du tracé
     * d'une ligne de transport. Pour tout ce qui emprunte la voirie, elle reste
     * vide jusqu'à la réponse du service de routage.
     */
    path?: GeoPoint[];
}

export type LegInput = CommonLegInput & (
    | {
        mode: Exclude<MobilityMode, 'transit'>;
        estimate?: Partial<LegEstimate>;
    }
    | {
        mode: 'transit';
        /** Une ligne de transport porte toujours le facteur de son route_type GTFS. */
        estimate: Partial<LegEstimate> & Pick<LegEstimate, 'carbonGramsPerKm'>;
    }
);

function carbonFactor(input: LegInput): number {
    if (input.mode === 'transit') {
        return input.estimate.carbonGramsPerKm;
    }
    return input.estimate?.carbonGramsPerKm ?? ROAD_EMISSION_FACTORS[input.mode].gramsCo2ePerPassengerKm;
}

/** Durée d'un segment : parcours ajuste de la congestion, plus le temps fixe. */
export function legDuration(travelMinutes: number, estimate: LegEstimate): number {
    return Math.max(Math.round(travelMinutes * estimate.travelFactor + estimate.overheadMinutes), 1);
}

export function createLeg(input: LegInput): RouteLeg {
    const roundedDistance = round(input.distanceKm, 2);
    // Une étape sans distance connue (correspondance dans une station) ne doit
    // pas recevoir la minute minimale d'un parcours. Seul son temps fixe compte.
    const travelMinutes = roundedDistance === 0 ? 0 : minutesForDistance(roundedDistance, SPEED_KMH[input.mode]);
    const estimate: LegEstimate = {
        travelFactor: input.estimate?.travelFactor ?? 1,
        overheadMinutes: input.estimate?.overheadMinutes ?? 0,
        carbonGramsPerKm: carbonFactor(input),
    };

    return {
        id: input.id,
        mode: input.mode,
        title: input.title,
        from: input.from.label,
        to: input.to.label,
        fromPoint: input.from,
        toPoint: input.to,
        path: input.path ?? [],
        distanceKm: roundedDistance,
        durationMinutes: legDuration(travelMinutes, estimate),
        carbonGrams: Math.round(roundedDistance * estimate.carbonGramsPerKm),
        accessible: input.accessible,
        detail: `${MODE_LABELS[input.mode]} sur ${roundedDistance.toFixed(2)} km.`,
        estimate,
    };
}

/** Mesures d'une option, toutes dérivées de ses segments. */
export interface LegSummary {
    path: GeoPoint[];
    distanceKm: number;
    durationMinutes: number;
    carbonGrams: number;
    accessible: boolean;
}

export function summarizeLegs(legs: RouteLeg[]): LegSummary {
    const distanceKm = round(legs.reduce((sum, leg) => sum + leg.distanceKm, 0), 2);
    const carbonGrams = Math.round(legs.reduce((sum, leg) => sum + leg.carbonGrams, 0));

    return {
        path: mergeLegPaths(legs),
        distanceKm,
        durationMinutes: Math.ceil(legs.reduce((sum, leg) => sum + leg.durationMinutes, 0)),
        carbonGrams,
        accessible: legs.every((leg) => leg.accessible),
    };
}

export function buildOption(input: {
    id: string;
    title: string;
    summary: string;
    modes: MobilityMode[];
    legs: RouteLeg[];
    reliabilityScore: number;
    warnings: string[];
}): RouteOption {
    return {
        ...input,
        ...summarizeLegs(input.legs),
        // La référence voiture dépend des extrémités de la recherche, pas de la
        // distance de l'option. Elle ne sera appliquée qu'après la mesure OSRM.
        carbonSavedGrams: null,
        carbonReference: null,
        instructions: buildFallbackInstructions(input.legs),
        score: 0,
    };
}

/**
 * Reporte sur l'option les mesures de ses segments une fois routes. Sans cela,
 * l'entête afficherait l'estimation à vol d'oiseau pendant que le détail
 * afficherait les distances réelles : deux chiffres différents pour le même
 * trajet.
 */
export function applyRoutedLegs(option: RouteOption, legs: RouteLeg[]): RouteOption {
    return { ...option, legs, ...summarizeLegs(legs) };
}


/**
 * Trace complet d'une option. Un segment dont la géométrie n'est pas encore
 * connue n'apporte rien : le tracé reste partiel plutôt que d'être complète par
 * une ligne droite qui ferait croire à un itinéraire.
 */
export function mergeLegPaths(legs: RouteLeg[]): GeoPoint[] {
    return legs.reduce<GeoPoint[]>((points, leg) => {
        const nextPoints = leg.path;
        if (nextPoints.length === 0) {
            return points;
        }
        if (points.length === 0) {
            return [...nextPoints];
        }

        const firstPoint = nextPoints[0];
        const shouldSkipFirst =
            firstPoint && points[points.length - 1].lat === firstPoint.lat && points[points.length - 1].lon === firstPoint.lon;
        return [...points, ...(shouldSkipFirst ? nextPoints.slice(1) : nextPoints)];
    }, []);
}

export function buildFallbackInstructions(legs: RouteLeg[]): RouteInstruction[] {
    const firstLeg = legs.find((leg) => leg.distanceKm > 0.03) ?? legs[0];
    if (!firstLeg) {
        return [];
    }

    if (firstLeg.mode === 'transit') {
        return [
            {
                kind: 'transfer',
                text: `Prendre ${firstLeg.title}`,
                distanceMeters: Math.round(firstLeg.distanceKm * 1000),
                detail: `${firstLeg.from} -> ${firstLeg.to}`,
            },
        ];
    }

    return [
        {
            kind: 'depart',
            text: `Se diriger vers ${firstLeg.to}`,
            distanceMeters: Math.round(firstLeg.distanceKm * 1000),
            detail: firstLeg.detail,
        },
    ];
}
