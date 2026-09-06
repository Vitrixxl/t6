// Régression du trajet qui ne proposait que la marche malgré les TCL sélectionnés.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';

const base = process.env.E2E_BASE_URL || 'https://localhost:4103';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox', '--ignore-certificate-errors'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const origin = { label: '13 Rue des Petites Sœurs', lat: 45.759969, lon: 4.867196 };
const destination = { label: '102 Avenue Paul Santy', lat: 45.72875, lon: 4.874245 };
// Une heure de service stable teste aussi le moteur lorsque la CI tourne la nuit.
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const departureAt = `${day}T12:00:00Z`;
const search = { origin, destination, modes: ['transit'], transitTypes: [0, 1, 3, 7], accessibilityNeed: false, departureAt };
try {
    const signup = await context.request.post(base + '/api/auth/register', { data: {
        email: `tcl-${randomUUID()}@example.test`, password: 'RecetteTCL2026!', displayName: 'Recette TCL', termsAccepted: true,
    } });
    assert.equal(signup.status(), 201);
    const network = await (await context.request.get(base + '/api/transport/context')).json();
    assert.equal(network.transitRoutingAvailable, true, 'Les TCL sont désactivés');
    const response = await context.request.post(base + '/api/transport/journeys', { data: search });
    assert(response.ok(), `Routage TCL : ${response.status()}`);
    const route = await response.json();
    assert(route.modes.includes('transit'), 'Le moteur ne propose encore que la marche');
    const walk = await (await context.request.post(base + '/api/transport/journeys', { data: { ...search, modes: [] } })).json();
    assert(route.durationMinutes < walk.durationMinutes, 'Le TCL choisi ne bat pas la marche');
    for (const leg of route.legs.filter(leg => leg.mode === 'transit')) {
        assert(leg.mapLabel, 'Ligne absente');
        assert.equal(leg.path.length, 0, 'Une droite entre arrêts est présentée comme un tracé TCL');
        assert(leg.detail.includes('Horaires théoriques TCL'), 'Nature des horaires absente');
        assert(leg.detail.includes('estimés'), 'Approximation du carbone absente');
    }
    const saved = await context.request.put(base + '/api/saved-routes/tcl-test', { data: {
        routeId: route.id, routeTitle: route.title, origin, destination, modes: route.modes,
        distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, carbonGrams: route.carbonGrams,
        carbonSavedGrams: route.carbonSavedGrams, createdAt: new Date().toISOString(),
    } });
    assert(saved.ok());
    await page.route('**/api/transport/journeys', request => request.continue({
        postData: JSON.stringify({ ...request.request().postDataJSON(), departureAt }),
    }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const welcome = page.getByRole('dialog', { name: 'Bienvenue sur UrbanFlow', exact: true });
    for (const name of ['Vélo’v', 'Dott']) await welcome.getByRole('button', { name, exact: true }).click();
    await welcome.getByRole('button', { name: 'Commencer' }).click();
    await page.getByRole('button', { name: /passer le tutoriel/i }).click();
    await page.locator('[data-tour="mobile-trips"]:visible').first().click();
    await page.getByRole('tab', { name: /Enregistrés/ }).click();
    const planned = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys'));
    await page.getByRole('button', { name: 'Charger', exact: true }).click();
    assert((await planned).ok());
    await page.getByText('Tracé TCL indisponible', { exact: true }).waitFor();
    assert.equal(await page.getByText(/Les horaires TCL seront intégrés/).count(), 0);
    await page.getByText(/^Détails du trajet/).click();
    await page.getByText(/Horaires théoriques TCL\./).first().waitFor();
    await page.locator('.ufm-endpoint-destination').waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tmp/screenshots/tcl-official-mobile.png' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByText('Tracé TCL indisponible', { exact: true }).waitFor();
    await page.locator('.ufm-endpoint-destination').waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'tmp/screenshots/tcl-official-desktop.png' });
    console.log(`TCL : ${route.summary} ${route.durationMinutes} min, marche ${walk.durationMinutes} min. Lignes, horaires et absence de faux tracés vérifiés sur mobile et bureau.`);
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/tcl-failure.png' });
    throw error;
} finally {
    await context.request.delete(base + '/api/me');
    await browser.close();
}
