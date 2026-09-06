// Certains accès piétons échouent dans le profil location de MOTIS alors que le
// profil marche les calcule. On reprend uniquement ces recherches, via un point
// du chemin piéton réel ; chaque portion reste mesurée et tracée par le moteur.
import { haversineDistanceKm } from '../../../../src/lib/planner/geo.ts';
import { fetchPlan, type MotisItinerary, type PlanQuery } from './client.ts';
import { fastestItinerary, usableItinerary } from './options.ts';
import { decodePolyline } from './polyline.ts';

const ARRIVAL_WALK_METERS = 150;

function arrivalAccess(walk: MotisItinerary): PlanQuery['to'] | null {
    const points = walk.legs.flatMap(leg => decodePolyline(leg.legGeometry.points, leg.legGeometry.precision))
        .map(([lat, lon]) => ({ lat, lon, label: 'Accès piéton' }));
    let distance = 0;
    for (let index = points.length - 1; index > 0; index--) {
        distance += haversineDistanceKm(points[index], points[index - 1]) * 1000;
        if (distance >= ARRIVAL_WALK_METERS) return points[index - 1];
    }
    return null;
}

function completeArrival(route: MotisItinerary, walk: MotisItinerary): MotisItinerary {
    const arrival = new Date(Date.parse(route.endTime) + walk.duration * 1000).toISOString();
    const approach = route.legs.map(leg => ({ ...leg, to: leg.to.name === 'END' ? { ...leg.to, name: 'Accès piéton à l’arrivée' } : leg.to }));
    const finish = walk.legs.map(leg => ({ ...leg, from: leg.from.name === 'START' ? { ...leg.from, name: 'Accès piéton à l’arrivée' } : leg.from }));
    return { ...route, endTime: arrival, duration: route.duration + walk.duration, legs: [...approach, ...finish] };
}

export async function recoverRentalArrival(baseUrl: string, query: PlanQuery, plans: MotisItinerary[], signal?: AbortSignal): Promise<MotisItinerary[]> {
    if (query.rentalFormFactors.length === 0) return [];
    const usable = plans.filter(usableItinerary);
    const hasDirectRental = usable.some(plan => plan.legs.some(leg => leg.mode === 'RENTAL') && plan.legs.every(leg => leg.mode === 'WALK' || leg.mode === 'RENTAL'));
    if (hasDirectRental) return [];
    const walk = fastestItinerary(usable.filter(plan => plan.legs.every(leg => leg.mode === 'WALK')));
    const access = walk ? arrivalAccess(walk) : null;
    if (!access) return [];
    const [approaches, finishes] = await Promise.all([
        fetchPlan(baseUrl, { ...query, to: access }, signal),
        fetchPlan(baseUrl, { ...query, from: access, transitModes: [], rentalFormFactors: [] }, signal),
    ]);
    const finish = fastestItinerary((finishes ?? []).filter(plan => plan.legs.every(leg => leg.mode === 'WALK')));
    if (!finish) return [];
    return (approaches ?? []).filter(usableItinerary)
        .filter(plan => plan.legs.some(leg => leg.mode === 'RENTAL'))
        .map(plan => completeArrival(plan, finish));
}
