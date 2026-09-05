// Vérifie le fichier réellement téléchargé depuis le profil, sur mobile et bureau.
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
let exportRequests = 0;
let downloads = 0;
page.on('request', (request) => { if (request.url().endsWith('/api/me/export')) exportRequests++; });
page.on('download', () => downloads++);

try {
    const email = `export-${randomUUID()}@example.test`;
    const registered = await context.request.post(`${baseURL}/api/auth/register`, {
        data: { email, password: 'UrbanFlow2026!', displayName: 'Test export' },
    });
    assert.equal(registered.status(), 201);
    const saved = await context.request.put(`${baseURL}/api/saved-routes/export-test`, { data: {
        routeId: 'walk-test', routeTitle: 'Trajet à exporter', score: 10,
        origin: { label: 'Départ', lat: 45.75, lon: 4.85 },
        destination: { label: 'Arrivée', lat: 45.76, lon: 4.86 },
        modes: ['walk'], distanceKm: 2, durationMinutes: 25, carbonGrams: 0,
        carbonSavedGrams: null, createdAt: new Date().toISOString(),
    } });
    assert.equal(saved.status(), 200);
    const { state } = await (await context.request.get(`${baseURL}/api/auth/session`)).json();
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /passer le tutoriel/i }).click({ timeout: 1500 }).catch(() => undefined);
    await page.getByRole('button', { name: 'Ouvrir le profil', exact: true }).click();
    const profile = page.getByRole('dialog', { name: 'Profil et préférences', exact: true });
    const button = profile.getByRole('button', { name: 'Exporter mes données', exact: true });
    for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await button.scrollIntoViewIfNeeded();
        const bounds = await button.boundingBox();
        assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
        const before = exportRequests;
        const pendingDownload = page.waitForEvent('download');
        await button.click();
        const download = await pendingDownload;
        assert.equal(download.suggestedFilename(), 'urbanflow-export.json');
        const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
        assert.equal(exported.account.email, email);
        assert(!Number.isNaN(Date.parse(exported.exportedAt)));
        for (const key of Object.keys(state)) assert.deepEqual(exported[key], state[key]);
        assert.equal(exported.savedRoutes[0].origin.lat, 45.75);
        assert.equal(exported.savedRoutes[0].carbonSavedGrams, null);
        assert.deepEqual(Object.keys(exported.account).sort(), ['createdAt', 'displayName', 'email', 'id']);
        assert.equal(exportRequests - before, 1);
        await profile.getByRole('status').waitFor();
        await page.screenshot({ path: `tmp/screenshots/export-${width}.png` });
    }
    const successfulDownloads = downloads;
    for (const status of [503, 401]) {
        await page.route('**/api/me/export', async (route) => {
            await setTimeout(300);
            await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'Export indisponible.' }) });
        });
        await button.click();
        assert(await profile.getByRole('button', { name: 'Export en cours…' }).isDisabled());
        await profile.getByRole('alert').waitFor();
        assert(await button.isEnabled());
        assert.equal(downloads, successfulDownloads);
        await page.unroute('**/api/me/export');
    }
    const retry = page.waitForEvent('download');
    await button.click();
    await retry;
    await profile.getByRole('status').waitFor();
    assert.equal(await profile.getByRole('alert').count(), 0);
    assert.deepEqual(errors, []);
    console.log('Export : JSON serveur, coordonnées, un appel, mobile/bureau, erreurs 503/401 et nouvel essai vérifiés.');
} finally {
    await context.request.delete(`${baseURL}/api/me`);
    await browser.close();
}
