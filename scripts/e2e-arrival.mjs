// Régression mobile : location puis accès piéton à une impasse, avec le vrai moteur et les flux en direct.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.env.E2E_BASE_URL || 'https://localhost:4103';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox', '--ignore-certificate-errors'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const origin = { label: '48 Rue Étienne Richerand', lat: 45.76097, lon: 4.86608 };
const destination = { label: '16 Impasse Saint Gervais', lat: 45.741898, lon: 4.863364 };
// Une heure de service stable teste aussi le moteur lorsque la CI tourne la nuit.
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const departureAt = `${day}T12:00:00Z`;
const search = { origin, destination, modes: ['bike', 'scooter'], transitTypes: [0, 1, 3, 7], accessibilityNeed: false, departureAt };
try {
    const signup = await context.request.post(base + '/api/auth/register', { data: {
        email: `arrival-${randomUUID()}@example.test`, password: 'RecetteArrivee2026!', displayName: 'Recette arrivée', termsAccepted: true,
    } });
    assert.equal(signup.status(), 201);
    const networkResponse = await context.request.get(base + '/api/transport/context');
    assert.equal(networkResponse.headers()['content-encoding'], 'gzip', 'Les disponibilités mobiles ne sont pas compressées');
    const network = await networkResponse.json();
    assert.equal(network.transitRoutingAvailable, true, 'Les TCL sont désactivés');
    const response = await context.request.post(base + '/api/transport/journeys', { data: search });
    assert(response.ok(), `Routage partagé : ${response.status()}`);
    const options = await response.json();
    const route = options[0];
    assert(route.modes.some(mode => mode === 'bike' || mode === 'scooter'), 'Aucun trajet partagé vers l’impasse');
    const [walk] = await (await context.request.post(base + '/api/transport/journeys', { data: { ...search, modes: [] } })).json();
    assert(route.durationMinutes < walk.durationMinutes, 'La location ne bat pas la marche');
    assert(route.legs.every(leg => leg.path.length >= 2), 'Un segment manque sur la carte');
    assert.deepEqual(route.legs.at(-1).toPoint, destination, 'La destination a été déplacée');
    const status = 'Tracé réel affiché';
    const saved = await context.request.put(base + '/api/saved-routes/arrival-test', { data: {
        routeId: route.id, routeTitle: route.title, origin, destination, modes: route.modes,
        distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, carbonGrams: route.carbonGrams,
        carbonSavedGrams: route.carbonSavedGrams, createdAt: new Date().toISOString(),
    } });
    assert(saved.ok());
    await page.route('**/api/transport/journeys', request => request.continue({
        postData: JSON.stringify({ ...request.request().postDataJSON(), modes: ['bike', 'scooter'], departureAt }),
    }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const welcome = page.getByRole('dialog', { name: 'Bienvenue sur UrbanFlow', exact: true });
    for (const name of ['Transport en commun']) await welcome.getByRole('button', { name, exact: true }).click();
    await welcome.getByRole('button', { name: 'Commencer' }).click();
    await page.getByRole('button', { name: /passer le tutoriel/i }).click();
    await page.locator('[data-tour="mobile-trips"]:visible').first().click();
    await page.getByRole('tab', { name: /Enregistrés/ }).click();
    const planned = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys'));
    await page.getByRole('button', { name: 'Charger', exact: true }).click();
    assert((await planned).ok());
    await page.getByText(status, { exact: true }).waitFor();
    assert.equal(await page.getByText(/Les horaires TCL seront intégrés/).count(), 0);
    await page.getByText(/^Détails du trajet/).click();
    await page.getByText(/Trottinette Dott|Vélo Vélov/).first().waitFor();
    await page.locator('.ufm-endpoint-destination').waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tmp/screenshots/arrival-mobile.png' });
    const mapPng = await page.locator('.maplibregl-canvas').screenshot();
    // Couleur du trajet après le filtre cartographique défini dans styles.css.
    const pixels = await page.evaluate(async data => {
        const image = new globalThis.Image();
        image.src = data;
        await image.decode();
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const drawing = canvas.getContext('2d');
        drawing.drawImage(image, 0, 0);
        const rgba = drawing.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let index = 0; index < rgba.length; index += 4) {
            if (Math.abs(rgba[index] - 87) < 20 && Math.abs(rgba[index + 1] - 155) < 20 && Math.abs(rgba[index + 2] - 108) < 20) count++;
        }
        return count;
    }, 'data:image/png;base64,' + mapPng.toString('base64'));
    assert(pixels > 100, 'Le tracé vert ne se voit pas sur la carte mobile');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByText(status, { exact: true }).waitFor();
    await page.locator('.ufm-endpoint-destination').waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tmp/screenshots/arrival-desktop.png' });
    console.log(`Impasse : ${route.summary} ${route.durationMinutes} min, marche ${walk.durationMinutes} min. Location, marche finale et tracés vérifiés sur mobile et bureau.`);
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/arrival-failure.png' });
    throw error;
} finally {
    await context.request.delete(base + '/api/me');
    await browser.close();
}
