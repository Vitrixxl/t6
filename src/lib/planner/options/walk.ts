// Generateur d'option : walk.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { buildOption, createLeg } from '../legs';

export function createWalkOption({ origin, destination }: RouteRequest, directKm: number): RouteOption {
    // Facteur de voirie: un itineraire pieton reel est plus long que le vol d'oiseau.
    const walkKm = directKm * 1.18;
    const legs: RouteLeg[] = [
        createLeg({
            id: 'walk-core',
            mode: 'walk',
            title: 'Marche',
            from: origin,
            to: destination,
            distanceKm: walkKm,
            accessible: true,
        }),
    ];

    return buildOption({
        id: 'walk',
        title: 'A pied',
        summary: 'Itineraire pieton direct, zero emission.',
        modes: ['walk'],
        legs,
        reliabilityScore: 92,
        warnings: [],
    });
}
