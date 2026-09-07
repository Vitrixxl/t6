// Une location directe ou un transport sans location peut dominer une combinaison.
// Chaque engin et chaque côté du réseau sont donc recherchés explicitement.
import { fetchPlan, type MotisItinerary, type PlanQuery } from './client.ts';

export async function fetchTransitCombinations(baseUrl: string, query: PlanQuery, signal?: AbortSignal): Promise<MotisItinerary[] | null> {
    if (query.transitModes.length === 0 || query.rentalFormFactors.length === 0) return [];
    const sides = ['access', 'egress'] as const;
    const requests = query.rentalFormFactors.flatMap(factor => sides.map(rentalTransitSide => fetchPlan(baseUrl, {
        ...query, rentalFormFactors: [factor], rentalTransitSide,
    }, signal)));
    const responses = await Promise.all(requests);
    if (responses.some(response => response === null)) return null;
    return responses.flatMap(response => response ?? []);
}
