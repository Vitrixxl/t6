// Générateur d'option : walk.
import type { RouteLeg, RouteOption, RouteRequest } from '../../../types';
import { buildOption, createLeg } from '../legs';

export function createWalkOption({ origin, destination }: RouteRequest, directKm: number): RouteOption {
    // Facteur de voirie: un itinéraire piéton réel est plus long que le vol d'oiseau.
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
        title: 'À pied',
        summary: 'Itinéraire piéton direct, zéro émission.',
        modes: ['walk'],
        legs,
        reliabilityScore: 92,
        warnings: [],
    });
}
