import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RouteOption } from '../../types';
import { MobileRouteChoices } from './MobilePanels';

it('rend les six options mobiles, y compris la dernière présélectionnée', () => {
    const routes: RouteOption[] = Array.from({ length: 6 }, (_, index) => ({
        id: `option-${index}`,
        title: `Option ${index}`,
        summary: '',
        modes: ['walk'],
        durationMinutes: 63,
        distanceKm: 4.8,
        carbonGrams: 0,
        carbonSavedGrams: null,
        carbonReference: null,
        reliabilityScore: 100,
        score: 50,
        accessible: true,
        warnings: [],
        legs: [],
        path: [],
        instructions: [],
    }));
    const html = renderToStaticMarkup(<MobileRouteChoices routes={routes} selectedRoute={routes[5]} onSelectRoute={() => undefined} />);
    expect(html.match(/<button /g)).toHaveLength(6);
    for (const route of routes) {
        expect(html).toContain(route.title);
    }
    expect(html).toContain('1h03');
    expect(html).not.toContain('63 min');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
});
