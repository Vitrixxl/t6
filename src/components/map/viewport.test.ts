import { expect, it } from 'bun:test';
import { routeViewportPadding } from './viewport';

it('laisse une zone de cadrage positive sur les petits canvas et en paysage', () => {
    for (const [width, height, desktop] of [[390, 844, false], [844, 390, false], [320, 240, false], [80, 80, true], [1, 1, false]] as const) {
        const padding = routeViewportPadding(width, height, desktop);
        expect(padding.left + padding.right).toBeLessThan(width);
        expect(padding.top + padding.bottom).toBeLessThan(height);
        expect(height - padding.top - padding.bottom).toBeGreaterThanOrEqual(height / 5 - 0.001);
    }
});

it('conserve les marges des contrôles lorsque le canvas est assez grand', () => {
    expect(routeViewportPadding(390, 844, false)).toEqual({ top: 140, bottom: 422, left: 48, right: 48 });
    expect(routeViewportPadding(800, 600, true)).toEqual({ top: 96, bottom: 88, left: 48, right: 48 });
});
