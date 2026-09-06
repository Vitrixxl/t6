// Le mode livré doit calculer un vrai trajet avec un MOTIS dépourvu de GTFS.
import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';
const base = process.env.E2E_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 320, height: 844 }, locale: 'fr-FR' });
const page = await context.newPage();
function assert(value, message) { if (!value) throw new Error(message); }
try {
    const signup = await context.request.post(base + '/api/auth/register', { data: {
        email: `streets-${randomUUID()}@example.test`, password: 'RecetteVoirie2026!', displayName: 'Sans horaires', termsAccepted: true,
    } });
    assert(signup.ok(), 'Inscription refusée');
    const network = await (await context.request.get(base + '/api/transport/context')).json();
    assert(network.transitRoutingAvailable === false, 'Horaires annoncés disponibles');
    assert(network.stopCount > 0, 'Les arrêts ont disparu');
    const saved = await context.request.put(base + '/api/saved-routes/streets-test', { data: {
        routeId: 'walk', routeTitle: 'Bellecour — Part-Dieu',
        origin: { label: 'Bellecour', lat: 45.7578, lon: 4.832 },
        destination: { label: 'Part-Dieu', lat: 45.7606, lon: 4.8594 },
        modes: ['walk'], distanceKm: 3, durationMinutes: 40, carbonGrams: 0, carbonSavedGrams: null,
        createdAt: new Date().toISOString(),
    } });
    assert(saved.ok(), 'Préparation refusée');
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByRole('dialog', { name: 'Bienvenue sur UrbanFlow', exact: true }).getByRole('button', { name: 'Commencer' }).click();
    await page.getByRole('button', { name: /passer le tutoriel/i }).click();
    await page.getByText(/Les horaires TCL seront intégrés/).waitFor();
    await page.locator('[data-tour="mobile-trips"]:visible').first().click();
    await page.getByRole('tab', { name: /Enregistrés/ }).click();
    const response = page.waitForResponse(response => response.url().endsWith('/api/transport/journeys'));
    await page.getByRole('button', { name: 'Charger', exact: true }).click();
    const result = await response;
    assert(result.ok(), `Routage sans GTFS refusé : ${result.status()}`);
    const options = await result.json();
    assert(options.every(option => option.modes.every(mode => mode !== 'transit')), 'Transport public proposé sans horaires');
    const route = options[0];
    assert(route.modes.every(mode => mode !== 'transit'), 'Transport public proposé sans horaires');
    assert(route.legs.every(leg => leg.path.length >= 2), 'Géométrie réelle absente');
    assert(route.durationMinutes > 0 && route.carbonReference.distanceKm > 0, 'Mesures absentes');
    await page.getByText(/^Détails du trajet/).waitFor();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.locator('.ufm-endpoint-destination').waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'tmp/screenshots/no-timetable-mobile.png' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByText(/Les horaires TCL seront intégrés/).waitFor();
    await page.locator('.ufm-endpoint-destination').waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'tmp/screenshots/no-timetable-desktop.png' });
    console.log('Sans GTFS : inscription, onboarding, bandeau, arrêts et itinéraire réel vérifiés sur mobile et bureau.');
} finally {
    await context.request.delete(base + '/api/me');
    await browser.close();
}
