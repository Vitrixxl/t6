// Assemblage d'un trajet à partir de ses segments : distance, carbone et
// accessibilité sont dérivés des segments, jamais saisis en double.
import type { GeoPoint, MobilityMode, RouteInstruction, RouteLeg, RouteOption } from '../../types';
import { round } from './metrics';

/** Mesures dérivées des segments. */
export interface LegSummary {
    path: GeoPoint[];
    distanceKm: number;
    carbonGrams: number;
    accessible: boolean;
}

export function summarizeLegs(legs: RouteLeg[]): LegSummary {
    return {
        path: mergeLegPaths(legs),
        distanceKm: round(legs.reduce((sum, leg) => sum + leg.distanceKm, 0), 2),
        carbonGrams: Math.round(legs.reduce((sum, leg) => sum + leg.carbonGrams, 0)),
        accessible: legs.every((leg) => leg.accessible),
    };
}

export function buildOption(input: {
    id: string;
    title: string;
    summary: string;
    modes: MobilityMode[];
    legs: RouteLeg[];
    /** Horaires et durée du moteur : la durée comprend les attentes, que les segments ne portent pas. */
    departureAt: string;
    arrivalAt: string;
    durationMinutes: number;
}): RouteOption {
    return {
        ...input,
        ...summarizeLegs(input.legs),
        // La référence voiture dépend des extrémités de la recherche, pas de la
        // distance du trajet : elle est appliquée une fois le trajet retenu.
        carbonSavedGrams: null,
        carbonReference: null,
        instructions: buildFallbackInstructions(input.legs),
    };
}


/**
 * Trace complet d'un trajet. Un segment dont la géométrie n'est pas encore
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
