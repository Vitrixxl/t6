// Construction des segments et assemblage d'une option a partir de ses
// segments : distance, duree, carbone et accessibilite sont derives des
// segments, jamais saisis en double.
import type { GeoPoint, MobilityMode, RouteInstruction, RouteLeg, RouteOption } from '../../types';
import { EMISSIONS_G_PER_KM, SPEED_KMH } from './constants';
import { MODE_LABELS } from './labels';
import { minutesForDistance, round } from './metrics';

/**
 * Description d'un segment. Les extremites sont des points, pas des libelles :
 * le routage a besoin des coordonnees, et l'interface tire le libelle du point.
 */
export interface LegInput {
  id: string;
  mode: MobilityMode;
  title: string;
  from: GeoPoint;
  to: GeoPoint;
  distanceKm: number;
  accessible: boolean;
  /**
   * Geometrie reelle, quand la source en publie une — c'est le cas du trace
   * d'une ligne de transport. Pour tout ce qui emprunte la voirie, elle reste
   * vide jusqu'a la reponse du service de routage.
   */
  path?: GeoPoint[];
}

export function createLeg(input: LegInput): RouteLeg {
  const roundedDistance = round(input.distanceKm, 2);
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
    durationMinutes: minutesForDistance(roundedDistance, SPEED_KMH[input.mode]),
    carbonGrams: Math.round(roundedDistance * EMISSIONS_G_PER_KM[input.mode]),
    accessible: input.accessible,
    detail: `${MODE_LABELS[input.mode]} sur ${roundedDistance.toFixed(2)} km.`,
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
  const distanceKm = round(input.legs.reduce((sum, leg) => sum + leg.distanceKm, 0), 2);
  const durationMinutes = Math.ceil(input.legs.reduce((sum, leg) => sum + leg.durationMinutes, 0));
  const carbonGrams = Math.round(input.legs.reduce((sum, leg) => sum + leg.carbonGrams, 0));
  const carbonSavedGrams = Math.max(Math.round(distanceKm * EMISSIONS_G_PER_KM.privateCar - carbonGrams), 0);

  return {
    ...input,
    path: mergeLegPaths(input.legs),
    distanceKm,
    durationMinutes,
    carbonGrams,
    carbonSavedGrams,
    accessible: input.legs.every((leg) => leg.accessible),
    instructions: buildFallbackInstructions(input.legs),
    score: 0,
  };
}

/**
 * Trace complet d'une option. Un segment dont la geometrie n'est pas encore
 * connue n'apporte rien : le trace reste partiel plutot que d'etre complete par
 * une ligne droite qui ferait croire a un itineraire.
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
