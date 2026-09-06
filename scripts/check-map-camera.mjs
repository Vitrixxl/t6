// Observe les repères rendus : la recette n’expose aucune poignée MapLibre en production.
import assert from 'node:assert/strict';

async function markerOffset(page) {
    return page.locator('.ufm-endpoint-destination').evaluate(marker => {
        const point = marker.getBoundingClientRect();
        const canvas = globalThis.document.querySelector('.maplibregl-canvas').getBoundingClientRect();
        return { x: point.x + point.width / 2 - canvas.x - canvas.width / 2, y: point.y + point.height / 2 - canvas.y - canvas.height / 2 };
    });
}

export async function checkFreeCamera(page, cdp) {
    await page.waitForTimeout(1000);
    const initial = await markerOffset(page);
    const box = await page.locator('.maplibregl-canvas').boundingBox();
    const start = { x: box.x + box.width * 0.2, y: box.y + box.height * 0.3 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + step * 10, y: start.y }] });
        await page.waitForTimeout(25);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(1000);
    const moved = await markerOffset(page);
    assert(Math.abs(moved.x - initial.x) > 30, 'La carte revient sur le trajet après déplacement');
    await page.evaluate(() => globalThis.dispatchEvent(new globalThis.Event('resize')));
    await page.waitForTimeout(900);
    const resized = await markerOffset(page);
    assert(Math.hypot(resized.x - moved.x, resized.y - moved.y) < 2, 'Un resize recentre le trajet déplacé');

    await page.mouse.move(start.x, start.y);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(900);
    const zoomed = await markerOffset(page);
    assert(Math.hypot(zoomed.x - moved.x, zoomed.y - moved.y) > 3, 'Le zoom ne modifie pas la caméra');
    const viewport = page.viewportSize();
    await page.setViewportSize({ ...viewport, height: viewport.height - 40 });
    await page.waitForTimeout(900);
    const after = await markerOffset(page);
    assert(Math.hypot(after.x - zoomed.x, after.y - zoomed.y) < 2, 'Le redimensionnement annule le déplacement ou le zoom');
    await page.setViewportSize(viewport);
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'tmp/screenshots/map-camera-free.png' });
    const planned = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys'));
    await page.getByRole('button', { name: 'Inverser départ et arrivée', exact: true }).click();
    assert((await planned).ok(), 'Le nouveau trajet ne se calcule pas');
    await page.waitForTimeout(1000);
    const destination = await page.locator('.ufm-endpoint-destination .ufm-endpoint-pin').boundingBox();
    const frame = await page.locator('.maplibregl-canvas').boundingBox();
    assert(destination.x > frame.x && destination.x + destination.width < frame.x + frame.width, 'Le nouveau trajet n’est pas cadré');
    assert(destination.y > frame.y && destination.y + destination.height < frame.y + frame.height, 'L’arrivée du nouveau trajet est hors cadre');
    console.log('Caméra : déplacement tactile, zoom et redimensionnements conservés ; nouveau trajet recadré.');
}
