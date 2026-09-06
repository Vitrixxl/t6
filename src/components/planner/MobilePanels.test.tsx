import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RouteOption } from '../../types';
import { MobileSelectedRouteCard } from './MobilePanels';

it('affiche le trajet retenu avec sa durée et ses horaires sur mobile', () => {
    const route: RouteOption = {
        id: 'walk', title: 'À pied', summary: '', modes: ['walk'],
        durationMinutes: 63, departureAt: '2026-09-06T08:00:00Z', arrivalAt: '2026-09-06T09:03:00Z',
        distanceKm: 4.8, carbonGrams: 0, carbonSavedGrams: null, carbonReference: null,
        accessible: true, legs: [], path: [], instructions: [],
    };
    const html = renderToStaticMarkup(<MobileSelectedRouteCard routeOption={route} />);
    expect(html).toContain('À pied');
    expect(html).toContain('1h03');
    expect(html).not.toContain('63 min');
    expect(html).toContain('Départ');
    expect(html).toContain('Arrivée');
});
