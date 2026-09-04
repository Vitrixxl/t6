// Vérifie le hub sur de vrais écrans Chromium et les annulations sur l’API locale.
import { chromium } from 'playwright-core';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
mkdirSync('tmp/screenshots', { recursive: true });

function assert(condition, message) {
    if (!condition) throw new Error(message);
}
async function put(path, data) {
    const response = await context.request.put(`${baseURL}/api${path}`, { data });
    assert(response.ok(), `${path} : ${response.status()} ${await response.text()}`);
    return response.json();
}
async function state() {
    return (await context.request.get(`${baseURL}/api/state`)).json();
}
async function openHub() {
    await page.getByRole('button', { name: /passer le tutoriel/i }).click({ timeout: 1500 }).catch(() => undefined);
    await page.locator('[data-tour="mobile-trips"]:visible').first().click();
    await page.getByRole('dialog', { name: 'Planificateur de trajets' }).waitFor();
}
async function tab(name) {
    await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click();
    await page.getByRole('tab', { name: new RegExp(`^${name}`), selected: true }).waitFor();
}
async function assertFits(label) {
    const overflow = await page.getByRole('dialog', { name: 'Planificateur de trajets' }).evaluate((dialog) => {
        const bounds = dialog.getBoundingClientRect();
        return [...dialog.querySelectorAll('*')].filter((element) => {
            const box = element.getBoundingClientRect();
            return box.width > 0 && (box.left < bounds.left - 1 || box.right > bounds.right + 1);
        }).map((element) => `${element.tagName}.${element.className}`).slice(0, 5);
    });
    assert(overflow.length === 0, `${label} : débordement ${overflow.join(', ')}`);
}

try {
    const email = `test-trajets-${randomUUID()}@example.test`;
    const registered = await context.request.post(`${baseURL}/api/auth/register`, {
        data: { email, password: 'UrbanFlow2026!', displayName: 'Test trajets' },
    });
    assert(registered.status() === 201, 'Création du compte de test impossible');
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000).toISOString().slice(0, 10);
    const createdAt = `${yesterday}T00:00:00.000Z`;
    const trip = {
        label: 'Domicile — Travail : trajet de vérification avec une longue adresse',
        origin: { label: 'Rue d’Arménie 69003 Lyon, Lyon 3e Arrondissement', lat: 45.75, lon: 4.85 },
        destination: { label: '105 Rue Garibaldi 69006 Lyon, Lyon 6e Arrondissement', lat: 45.76, lon: 4.85 },
        modes: ['bike'], distanceKm: 3, durationMinutes: 22, carbonGrams: 30, carbonSavedGrams: 400, createdAt,
    };
    await put('/trips/recurring/work', {
        ...trip, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], departureTime: '08:00', returnTime: '18:00',
        timeZone: 'Europe/Paris', periods: [{ from: createdAt, to: `${yesterday}T23:59:00.000Z` }],
    });
    await put('/trips/planned/past', { ...trip, scheduledFor: `${yesterday}T09:00:00.000Z`, status: 'planned', completedAt: null });
    await put('/trips/planned/past/completion');
    await put('/trips/planned/future', { ...trip, scheduledFor: new Date(today.getTime() + 86_400_000).toISOString(), status: 'planned', completedAt: null });
    await put('/saved-routes/saved', { ...trip, routeId: 'bike', routeTitle: trip.label, score: 80 });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await openHub();
    for (const width of [320, 390, 540, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        for (const label of ['Une fois', 'Récurrents', 'Historique', 'Enregistrés']) {
            await tab(label);
            await assertFits(`${width}px / ${label}`);
        }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await tab('Récurrents');
    const dialog = page.getByRole('dialog', { name: 'Planificateur de trajets' });
    assert(await dialog.getByRole('button', { name: /^(fait|annuler)/i }).count() === 0, 'Une routine ne doit pas être cochable');
    await page.screenshot({ path: 'tmp/screenshots/trips-recurring-mobile.png' });
    await tab('Historique');
    await dialog.getByRole('button', { name: 'Annuler les deux', exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'tmp/screenshots/trips-history-mobile.png' });
    const waitCancel = page.waitForResponse((response) => response.url().includes('/cancellations/') && response.request().method() === 'PUT');
    await dialog.getByRole('button', { name: 'Annuler l’aller', exact: true }).click();
    assert((await waitCancel).ok(), 'Annulation aller refusée');
    let remote = await state();
    assert(remote.recurringTrips[0].cancelledPassages.length === 1, 'L’aller n’est pas persisté seul');
    assert(remote.recurringTrips[0].cancelledPassages[0].direction === 'outbound', 'Mauvais sens annulé');
    await page.reload({ waitUntil: 'networkidle' });
    await openHub();
    await tab('Historique');
    assert(await dialog.getByRole('button', { name: 'Annuler l’aller', exact: true }).count() === 0, 'L’annulation aller disparaît au rechargement');
    const waitReturn = page.waitForResponse((response) => response.url().includes('/cancellations/') && response.request().method() === 'PUT');
    await dialog.getByRole('button', { name: 'Annuler le retour', exact: true }).click();
    assert((await waitReturn).ok(), 'Annulation retour refusée');
    const waitOnce = page.waitForResponse((response) => response.url().endsWith('/past/cancellation'));
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    assert((await waitOnce).ok(), 'Annulation ponctuelle refusée');
    remote = await state();
    assert(remote.recurringTrips[0].cancelledPassages.length === 2, 'Les deux sens ne sont pas conservés');
    assert(remote.tripRecords.length === 0, 'Le ponctuel annulé contribue encore au carbone');
    assert(remote.plannedTrips.find((item) => item.id === 'past').status === 'cancelled', 'Trace ponctuelle perdue');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'tmp/screenshots/trips-cancelled-mobile.png' });
    await put('/trips/recurring/both', {
        ...trip, label: 'Annulation groupée', daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        departureTime: '08:00', returnTime: '18:00', timeZone: 'Europe/Paris',
        periods: [{ from: createdAt, to: `${yesterday}T23:59:00.000Z` }],
    });
    await page.reload({ waitUntil: 'networkidle' });
    await openHub();
    await tab('Historique');
    const waitBoth = page.waitForResponse((response) => response.url().includes('/both/cancellations/'));
    await dialog.getByRole('button', { name: 'Annuler les deux', exact: true }).click();
    assert((await waitBoth).ok(), 'Annulation des deux sens refusée');
    remote = await state();
    assert(remote.recurringTrips.find((item) => item.id === 'both').cancelledPassages.length === 2, 'Les deux sens ne sont pas annulés ensemble');
    assert(errors.length === 0, `Erreurs navigateur : ${errors.join(', ')}`);
    console.log('Hub : 4 onglets × 5 largeurs sans débordement ; annulations aller/retour/ponctuel persistées après rechargement.');
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/trips-failure.png' });
    throw error;
} finally {
    await context.request.delete(`${baseURL}/api/me`).catch(() => undefined);
    await browser.close();
}
