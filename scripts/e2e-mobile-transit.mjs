// Calcul complet avec le feed WFS livré, l’API et le moteur MOTIS local.
import { file } from 'bun';
import { URL } from 'node:url';
import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';
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
    await page.getByRole('dialog', { name: 'Bienvenue sur UrbanFlow', exact: true }).getByRole('button', { name: 'Commencer' }).click();
    await page.getByRole('button', { name: /passer le tutoriel/i }).click();
    await page.locator('[data-tour="mobile-trips"]:visible').first().click();
    await page.getByRole('tab', { name: /Enregistrés/ }).click();
    const firstResponse = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys'));
    await page.getByRole('button', { name: 'Charger', exact: true }).click();
    assert((await firstResponse).ok(), 'Le moteur ne propose aucun trajet');
    const detailToggle = page.getByText(/^Détails du trajet/);
    await detailToggle.waitFor({ timeout: 60000 });
    const filter = page.getByRole('button', { name: /^Moyens de transport :/ });
    const sheet = page.locator('[data-tour="routes"]:visible');
    assert(await detailToggle.locator('..').getAttribute('open') === null, 'Détails ouverts au départ');
    assert(await page.getByRole('group', { name: 'Options d’itinéraire' }).count() === 0, 'Ancienne liste conservée');
    for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const panel = await sheet.boundingBox();
        assert(panel.height <= 423, 'Panneau supérieur à la moitié de l’écran');
        await detailToggle.click();
        assert((await sheet.boundingBox()).height <= 423, 'Déplier masque la carte');
        await detailToggle.click();
        await page.screenshot({ path: `tmp/screenshots/mobile-types-${width}.png` });
    }
    await filter.click();
    for (const type of ['Métro', 'Tramway', 'Funiculaire']) await page.getByRole('checkbox', { name: type, exact: true }).uncheck();
    await page.keyboard.press('Escape');
    await detailToggle.waitFor({ timeout: 60000 });
    await detailToggle.click();
    await page.getByText(/Bus TB11 direction/).first().waitFor({ timeout: 60000 });
    await filter.click();
    await page.getByRole('checkbox', { name: 'Métro', exact: true }).check();
    const metroResponse = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys') && response.request().postDataJSON().transitTypes.join() === '1');
    await page.getByRole('checkbox', { name: 'Bus', exact: true }).uncheck();
    const metro = await (await metroResponse).json();
    assert(metro.legs.every(leg => leg.mode !== 'transit' || leg.mapLabel.startsWith('Métro ')), 'Type de transport non demandé');
    const walkResponse = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys') && response.request().postDataJSON().transitTypes.length === 0);
    await page.getByRole('checkbox', { name: 'Métro', exact: true }).uncheck();
    const walk = await (await walkResponse).json();
    assert(walk.modes.length === 1 && walk.modes[0] === 'walk', 'Un transport reste proposé sans type autorisé');
    await page.keyboard.press('Escape');
    await filter.waitFor();
    await page.setViewportSize({ width: 844, height: 390 });
    assert((await sheet.boundingBox()).height <= 390 * 0.45 + 1, 'Panneau paysage trop grand');
    await page.getByRole('button', { name: "Fermer l'itinéraire", exact: true }).waitFor();
    await page.screenshot({ path: 'tmp/screenshots/mobile-types-landscape.png' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await filter.waitFor();
    await page.screenshot({ path: 'tmp/screenshots/mobile-types-desktop.png' });
    console.log('Trajet unique : bus seul, métro seul, marche seule, filtres récupérables, détails et paysage vérifiés.');
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/bus-failure.png' });
    console.log((await page.locator('body').innerText()).slice(-5000));
    throw error;
} finally {
    await context.request.delete(base + '/api/me');
    await browser.close();
}
