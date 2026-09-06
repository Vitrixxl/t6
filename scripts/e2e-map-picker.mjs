// L’appui reste exploitable après le relâchement, une mise à jour GPS et plusieurs sélections.
import assert from 'node:assert/strict';
import { checkFreeCamera } from './check-map-camera.mjs';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
const base = process.env.E2E_BASE_URL || 'https://localhost:4102';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ignoreHTTPSErrors: true,
    permissions: ['geolocation'], geolocation: { latitude: 45.7578, longitude: 4.832, accuracy: 10 },
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const picker = page.locator('.ufm-picker');
const canvas = page.locator('.maplibregl-canvas');
async function touch(type, touchPoints = []) { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints }); }
async function pointOnMap(fraction = 0.5) {
    // Le resize du canvas suit celui du viewport au rendu suivant.
    await page.waitForFunction(() => {
        const surface = globalThis.document.querySelector('.maplibregl-canvas');
        const frame = surface?.closest('.maplibregl-map');
        if (!surface || !frame) return false;
        const actual = surface.getBoundingClientRect();
        const expected = frame.getBoundingClientRect();
        return Math.abs(actual.width - expected.width) < 1 && Math.abs(actual.height - expected.height) < 1;
    });
    const box = await canvas.boundingBox();
    assert(box, 'Carte absente');
    return { x: box.x + box.width * fraction, y: box.y + box.height * 0.55 };
}
async function hold(point) {
    await touch('touchStart', [point]);
    await picker.waitFor({ timeout: 5000 });
}
async function stillOpen(message) {
    await page.waitForTimeout(400);
    assert(await picker.isVisible(), message);
    assert.equal(await page.locator('.ufm-picker').count(), 1, 'Plusieurs sélecteurs ouverts');
}
try {
    const registration = await context.request.post(base + '/api/auth/register', { data: {
        email: `picker-${randomUUID()}@example.test`, password: 'RecetteCarte2026!', displayName: 'Appui long', termsAccepted: true,
    } });
    assert.equal(registration.status(), 201);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const welcome = page.getByRole('dialog', { name: 'Bienvenue sur UrbanFlow', exact: true });
    for (const name of ['Vélo’v', 'Dott', 'Transport en commun']) await welcome.getByRole('button', { name, exact: true }).click();
    await welcome.getByRole('button', { name: 'Commencer' }).click();
    await page.getByRole('button', { name: /passer le tutoriel/i }).click();
    await canvas.waitFor();
    await page.getByRole('button', { name: 'Ma position', exact: true }).click();
    await page.waitForTimeout(800);

    const first = await pointOnMap();
    await hold(first);
    await touch('touchEnd');
    await stillOpen('Le clic de relâchement ferme le sélecteur');
    await context.setGeolocation({ latitude: 45.7579, longitude: 4.8321, accuracy: 20 });
    await page.waitForTimeout(800);
    await stillOpen('Une mise à jour GPS ferme le sélecteur');
    await page.setViewportSize({ width: 844, height: 390 });
    await stillOpen('La rotation ferme le sélecteur');
    await picker.getByRole('button', { name: 'Définir comme départ', exact: true }).tap();
    await picker.waitFor({ state: 'hidden' });
    await page.locator('.ufm-endpoint-origin').waitFor();
    console.log('Relâchement, GPS, rotation et sélection du départ vérifiés.');

    await page.setViewportSize({ width: 390, height: 844 });
    const next = await pointOnMap(0.7);
    await hold(next);
    await touch('touchEnd');
    await stillOpen('Le second appui disparaît');
    const response = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys'));
    await picker.getByRole('button', { name: 'Définir comme arrivée', exact: true }).tap();
    assert((await response).ok(), 'La sélection ne lance pas de trajet exploitable');
    await page.locator('.ufm-endpoint-destination').waitFor();
    await checkFreeCamera(page, cdp);
    await page.getByRole('button', { name: "Fermer l'itinéraire", exact: true }).click();
    await page.waitForTimeout(800);

    const empty = await pointOnMap();
    await touch('touchStart', [empty]);
    await touch('touchEnd');
    await page.waitForTimeout(700);
    assert.equal(await picker.count(), 0, 'Un tap court ouvre le sélecteur');
    await touch('touchStart', [empty]);
    await touch('touchMove', [{ x: empty.x + 40, y: empty.y }]);
    await page.waitForTimeout(650);
    await touch('touchEnd');
    assert.equal(await picker.count(), 0, 'Un déplacement ouvre le sélecteur');
    await page.waitForTimeout(700);
    await touch('touchStart', [{ ...empty, id: 1 }, { x: empty.x + 50, y: empty.y, id: 2 }]);
    await page.waitForTimeout(650);
    await touch('touchEnd');
    assert.equal(await picker.count(), 0, 'Un geste à deux doigts ouvre le sélecteur');
    await touch('touchStart', [empty]);
    await touch('touchCancel');
    await page.waitForTimeout(650);
    assert.equal(await picker.count(), 0, 'Un geste annulé ouvre le sélecteur');

    await hold(await pointOnMap());
    await touch('touchEnd');
    await stillOpen('Le sélecteur ne se rouvre plus après annulation');
    await page.touchscreen.tap(empty.x + 100, empty.y + 100);
    await picker.waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 320, height: 844 });
    await hold(await pointOnMap());
    await touch('touchEnd');
    await stillOpen('Sélecteur inutilisable à 320 px');
    await page.screenshot({ path: 'tmp/screenshots/map-picker-mobile.png' });
    await page.locator('.maplibregl-popup:has(.ufm-picker) .maplibregl-popup-close-button').click();
    await picker.waitFor({ state: 'hidden' });

    await page.setViewportSize({ width: 1280, height: 900 });
    await canvas.waitFor();
    await page.waitForTimeout(1000);
    await page.getByText('GPS ok - précision 20 m', { exact: true }).waitFor();
    const desktop = await pointOnMap();
    await page.mouse.move(desktop.x, desktop.y);
    await page.mouse.down();
    await picker.waitFor({ timeout: 5000 });
    await page.mouse.up();
    await stillOpen('Le relâchement souris ferme le sélecteur');
    await context.setGeolocation({ latitude: 45.758, longitude: 4.8322, accuracy: 30 });
    await page.getByText('GPS ok - précision 30 m', { exact: true }).waitFor();
    await stillOpen('Le rafraîchissement GPS observé ferme le sélecteur');
    await page.screenshot({ path: 'tmp/screenshots/map-picker-desktop.png' });
    console.log('Arrivée et trajet, gestes ignorés, appuis répétés, fermeture explicite et bureau vérifiés.');
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/map-picker-failure.png' });
    throw error;
} finally {
    await context.request.delete(base + '/api/me');
    await browser.close();
}
