// Régression du trajet qui ne proposait que la marche malgré les TCL sélectionnés.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { checkRouteChoices } from './check-route-choices.mjs';

const base = process.env.E2E_BASE_URL || 'https://localhost:4103';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox', '--ignore-certificate-errors'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(30000);
const tb12 = process.env.E2E_TCL_CASE === 'tb12';
const origin = tb12 ? { label: '99 Rue Robert', lat: 45.76463, lon: 4.8563 } : { label: '13 Rue des Petites Sœurs', lat: 45.759969, lon: 4.867196 };
const destination = tb12 ? { label: '2ter Rue Pauline Kergomard', lat: 45.74966, lon: 4.85093 } : { label: '102 Avenue Paul Santy', lat: 45.72875, lon: 4.874245 };
// Une heure de service stable teste aussi le moteur lorsque la CI tourne la nuit.
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
const departureAt = `${day}T12:00:00Z`;
const search = { origin, destination, modes: ['transit'], transitTypes: tb12 ? [3] : [0, 1, 3, 7], accessibilityNeed: false, departureAt };
try {
    const signup = await context.request.post(base + '/api/auth/register', { data: {
        email: `tcl-${randomUUID()}@example.test`, password: 'RecetteTCL2026!', displayName: 'Recette TCL', termsAccepted: true,
    } });
    assert.equal(signup.status(), 201);
    const network = await (await context.request.get(base + '/api/transport/context')).json();
    assert.equal(network.transitRoutingAvailable, true, 'Les TCL sont désactivés');
    const response = await context.request.post(base + '/api/transport/journeys', { data: search });
    assert(response.ok(), `Routage TCL : ${response.status()}`);
    const options = await response.json();
    const route = options[0];
    assert(route.modes.includes('transit'), 'Le moteur ne propose encore que la marche');
    const [walk] = await (await context.request.post(base + '/api/transport/journeys', { data: { ...search, modes: [] } })).json();
    assert(route.durationMinutes < walk.durationMinutes, 'Le TCL choisi ne bat pas la marche');
    for (const leg of route.legs.filter(leg => leg.mode === 'transit')) {
        assert(leg.mapLabel, 'Ligne absente');
        assert(Number.isInteger(leg.waitingSeconds), 'Attente absente');
        assert(leg.boardingAt, 'Heure d’embarquement absente');
        assert(leg.lineCode, 'Numéro ou lettre de ligne absent');
        assert(leg.path.length === 0 || leg.path.length > 2, 'Tracé TCL réduit à une droite');
        assert(leg.detail.includes('Horaires théoriques TCL'), 'Nature des horaires absente');
        assert(leg.detail.includes(leg.path.length ? 'Tracé officiel SYTRAL' : 'Tracé de ligne indisponible'), 'État du tracé absent');
    }
    assert(route.legs.some(leg => leg.mode === 'transit' && leg.path.length > 2), 'Aucun tracé TCL raccordé');
    if (tb12) assert(route.legs.some(leg => leg.lineCode === 'TB12' && leg.path.length > 2), 'Tracé TB12 absent');
    const status = route.legs.some(leg => leg.path.length < 2) ? 'Une partie du tracé est indisponible' : 'Tracé réel affiché';
    const saved = await context.request.put(base + '/api/saved-routes/tcl-test', { data: {
        routeId: route.id, routeTitle: route.title, origin, destination, modes: route.modes,
        distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, carbonGrams: route.carbonGrams,
        carbonSavedGrams: route.carbonSavedGrams, createdAt: new Date().toISOString(),
    } });
    assert(saved.ok());
    await page.route('**/api/transport/journeys', request => request.continue({
        postData: JSON.stringify({ ...request.request().postDataJSON(), departureAt, ...(tb12 ? { transitTypes: [3] } : {}) }),
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
    await page.getByText(status, { exact: true }).waitFor();
    assert.equal(await page.getByText(/Les horaires TCL seront intégrés/).count(), 0);
    const sequence = page.getByRole('button', { pressed: true }).getByRole('list', { name: 'Moyens de transport du trajet' });
    await sequence.waitFor();
    assert.equal(await page.getByText(/^Attente :/).filter({ visible: true }).count(), 0, 'Les détails doivent être repliés');
    const visibleLabels = await sequence.locator('li').evaluateAll(items => items.map(item => {
        const clone = item.cloneNode(true);
        clone.querySelectorAll('.sr-only').forEach(label => label.remove());
        return clone.textContent.trim();
    }));
    assert(visibleLabels.some(label => label.length > 0), 'Aucun numéro de ligne dans les icônes');
    assert(visibleLabels.every(label => !/marche|pied|bus|métro|tram/i.test(label)), 'Le résumé doit montrer des pictogrammes');
    assert((await sequence.locator('svg').count()) >= visibleLabels.length * 2 - 1, 'Icônes ou flèches manquantes');
    await page.screenshot({ path: `tmp/screenshots/tcl-${tb12 ? 'tb12' : 'official'}-collapsed.png` });
    await page.getByText(/^Détails du trajet/).click();
    await page.getByText(/^Attente :/).first().waitFor();
    await page.getByText(/Départ à/).first().waitFor();
    await page.getByText(/Horaires théoriques TCL\./).first().waitFor();
    await page.locator('.ufm-endpoint-destination').waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `tmp/screenshots/tcl-${tb12 ? 'tb12' : 'official'}-mobile.png` });
    await page.getByText(/^Attente :/).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tmp/screenshots/tcl-${tb12 ? 'tb12' : 'official'}-waiting.png` });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByText(status, { exact: true }).waitFor();
    await page.locator('.ufm-endpoint-destination').waitFor();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `tmp/screenshots/tcl-${tb12 ? 'tb12' : 'official'}-desktop.png` });
    await checkRouteChoices(page, options);
    console.log(`TCL : ${route.summary} ${route.durationMinutes} min, marche ${walk.durationMinutes} min. Lignes, horaires et tracés officiels vérifiés sur mobile et bureau.`);
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/tcl-failure.png' });
    throw error;
} finally {
    await context.request.delete(base + '/api/me');
    await browser.close();
}
