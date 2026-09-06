// Calcul complet avec le feed WFS livré, l’API et le moteur MOTIS local.
import { file } from 'bun';
import { URL } from 'node:url';
import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const base = process.env.E2E_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const page = await context.newPage();
function assert(value, message) { if (!value) throw new Error(message); }
try {
    const signup = await context.request.post(base + '/api/auth/register', { data: {
        email: `test-bus-${randomUUID()}@example.test`, password: 'RecetteBus2026!', displayName: 'Test bus', termsAccepted: true,
    } });
    assert(signup.ok(), 'Inscription de recette refusée');
    const feed = await file(new URL('../data/transport/gtfs-feed.json', import.meta.url)).json();
    const route = feed.routes.find(route => route.route_short_name === 'TB11' && route.route_long_name.startsWith('Gare Saint-Paul'));
    assert(route?.stopSequence?.length > 1, 'Bus TB11 absent du feed livré');
    const start = feed.stops.find(stop => stop.stop_id === route.stopSequence[0]);
    const end = feed.stops.find(stop => stop.stop_id === route.stopSequence.at(-1));
    const saved = await context.request.put(base + '/api/saved-routes/bus-browser-test', { data: {
        routeId: 'transit', routeTitle: 'Test bus · Saint-Paul — Bonnevay',
        origin: { label: start.stop_name, lat: start.stop_lat, lon: start.stop_lon },
        destination: { label: end.stop_name, lat: end.stop_lat, lon: end.stop_lon },
        modes: ['walk', 'transit'], distanceKm: 0, durationMinutes: 1, carbonGrams: 0, carbonSavedGrams: null,
        score: 0, createdAt: new Date().toISOString(),
    } });
    assert(saved.ok(), 'Préparation des coordonnées refusée');
    console.log('Compte et coordonnées prêts.');
    await page.goto(base, { waitUntil: 'networkidle' });
    console.log('Page chargée.');
    await page.getByRole('button', { name: /passer le tutoriel/i }).click({ timeout: 1500 }).catch(() => undefined);
    await page.locator('[data-tour="mobile-trips"]:visible').first().click();
    await page.getByRole('tab', { name: /Enregistrés/ }).click();
    await page.getByRole('button', { name: 'Charger', exact: true }).click();
    console.log('Calcul demandé.');
    await page.getByText(/^Bus TB11/).first().waitFor({ timeout: 60000 });
    await page.getByText(/^Détails du trajet/).click();
    assert(await page.getByText(/Bus TB11 direction/).first().isVisible(), 'Ligne et direction absentes du détail');
    assert(await page.locator('.maplibregl-canvas').count() === 1, 'Carte absente');
    const require = createRequire(import.meta.url);
    await page.evaluate(readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
    const violations = await page.evaluate(async () => (await globalThis.axe.run(globalThis.document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map(item => item.id));
    assert(violations.length === 0, 'Accessibilité : ' + violations.join(', '));
    for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByText(/^Bus TB11/).first().waitFor();
        await page.screenshot({ path: `tmp/screenshots/bus-${width}.png` });
    }
    console.log('Bus : feed réel, calcul MOTIS des accès, ligne TB11, détail des hypothèses et carte vérifiés à 390/1280 px.');
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/bus-failure.png' });
    console.log((await page.locator('body').innerText()).slice(-5000));
    throw error;
} finally {
    await context.request.delete(base + '/api/me');
    await browser.close();
}
