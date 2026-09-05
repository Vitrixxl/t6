// Calcul complet avec le feed WFS livré, l’API et les moteurs OSRM locaux.
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
        email: `test-bus-${randomUUID()}@example.test`, password: 'RecetteBus2026!', displayName: 'Test bus',
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
    const choices = page.getByRole('group', { name: 'Options d’itinéraire', exact: true });
    const transitChoice = choices.getByRole('button', { name: /^Transport en commun/ });
    await transitChoice.waitFor({ timeout: 60000 });
    await transitChoice.click();
    const filter = page.getByRole('button', { name: /^Types de transport en commun/ });
    await filter.waitFor();
    const sheet = page.locator('[data-tour="routes"]:visible');
    const detailToggle = page.getByText(/^Détails du trajet/);
    assert(await detailToggle.locator('..').getAttribute('open') === null, 'Les détails doivent être fermés au départ');
    for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const panel = await sheet.boundingBox();
        const search = await page.locator('[data-tour="mobile-search"]:visible').boundingBox();
        assert(panel.height <= 844 / 2 + 1, 'Panneau supérieur à la moitié de l’écran');
        assert(panel.y - search.y - search.height >= 180, 'Carte masquée');
        assert(await choices.evaluate(el => el.scrollWidth > el.clientWidth), 'Pas de défilement horizontal');
        const rows = await choices.getByRole('button').evaluateAll(items => items.map(item => item.getBoundingClientRect().top));
        assert(Math.max(...rows) - Math.min(...rows) < 2, 'Les options prennent plusieurs rangées');
        await choices.getByRole('button').last().click();
        assert(await choices.evaluate(el => el.scrollLeft > 0), 'La dernière option reste hors écran');
        assert(await filter.count() === 0, 'Filtre affiché pour une option sans transport public');
        await transitChoice.click();
        await filter.waitFor();
        await page.screenshot({ path: `tmp/screenshots/mobile-types-${width}.png` });
    }
    await detailToggle.click();
    assert((await sheet.boundingBox()).height <= 423, 'Déplier masque la carte');
    await detailToggle.click();
    await filter.click();
    for (const type of ['Métro', 'Tramway', 'Funiculaire']) await page.getByRole('checkbox', { name: type, exact: true }).uncheck();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Types de transport en commun : Bus', exact: true }).waitFor();
    await page.getByText(/^Détails du trajet/).click();
    await page.getByText(/Bus TB11 au départ/).waitFor({ timeout: 60000 });
    await filter.click();
    await page.getByRole('checkbox', { name: 'Métro', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Bus', exact: true }).uncheck();
    await page.keyboard.press('Escape');
    await page.getByText(/Métro .*au départ/).first().waitFor({ state: 'attached', timeout: 60000 });
    await page.getByText(/^Détails du trajet/).click();
    await page.getByText(/Métro .*au départ/).first().waitFor();
    assert(await page.getByText(/Bus TB11 au départ/).count() === 0, 'Bus conservé malgré le filtre métro');
    await filter.click();
    await page.getByRole('checkbox', { name: 'Métro', exact: true }).uncheck();
    await page.keyboard.press('Escape');
    await page.getByRole('status').filter({ hasText: 'Aucun trajet en transport en commun avec ces types' }).waitFor({ timeout: 60000 });
    await filter.waitFor();
    await choices.getByRole('button', { name: /^À pied/ }).click();
    assert(await filter.count() === 0, 'Le filtre doit disparaître pour la marche');
    await transitChoice.waitFor({ timeout: 60000 });
    await transitChoice.click();
    await page.getByRole('button', { name: 'Types de transport en commun : Tous', exact: true }).waitFor();
    await page.setViewportSize({ width: 844, height: 390 });
    assert((await sheet.boundingBox()).height <= 390 * 0.45 + 1, 'Panneau paysage trop grand');
    await page.getByRole('button', { name: "Fermer l'itinéraire", exact: true }).waitFor();
    await page.screenshot({ path: 'tmp/screenshots/mobile-types-landscape.png' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await filter.waitFor();
    await page.screenshot({ path: 'tmp/screenshots/mobile-types-desktop.png' });
    console.log('Types TC : affichage conditionnel, bus seul, métro seul, absence de résultat récupérable ; mobile : rangée horizontale, carte visible, détails et paysage vérifiés.');
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/bus-failure.png' });
    console.log((await page.locator('body').innerText()).slice(-5000));
    throw error;
} finally {
    await context.request.delete(base + '/api/me');
    await browser.close();
}
