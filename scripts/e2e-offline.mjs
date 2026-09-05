// La coupure est appliquée au navigateur : un simple événement synthétique ne
// prouverait ni l'état initial hors ligne ni le rechargement depuis le cache.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || process.env.CHROMIUM_PATH || '/usr/sbin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:4000';
const message = 'Vous êtes hors ligne. Une connexion Internet est nécessaire pour rechercher des itinéraires et enregistrer vos modifications. Les informations déjà affichées peuvent être périmées.';
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR' });
const page = await context.newPage();
page.setDefaultTimeout(8000);

async function checkOffline(screen, width, height = 844) {
    await page.setViewportSize({ width, height });
    await context.setOffline(true);
    const banner = page.getByRole('status').filter({ hasText: 'Vous êtes hors ligne.' });
    await banner.waitFor({ state: 'visible' });
    assert.equal((await banner.innerText()).replace(/\s+/g, ' ').trim(), message);
    const box = await banner.boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height);
    const main = await page.getByRole('main').boundingBox();
    assert.ok(main && main.y >= box.y + box.height, 'Le bandeau ne doit pas recouvrir les contrôles.');
    await page.screenshot({ path: `tmp/screenshots/offline-${screen}-${width}.png` });
    await context.setOffline(false);
    await banner.waitFor({ state: 'hidden' });
    console.log(`Hors ligne puis reconnexion : ${screen}, ${width} × ${height} OK`);
}

try {
    await page.goto(baseUrl);
    await page.locator('#auth-email').waitFor();
    await page.evaluate(async () => { await globalThis.navigator.serviceWorker.ready; });
    await page.waitForFunction(() => Boolean(globalThis.navigator.serviceWorker.controller));
    for (const width of [320, 390, 1280]) {
        await checkOffline('connexion', width);
    }

    // Une panne de l'API avec le réseau actif reste une erreur serveur.
    await page.route('**/api/auth/login', (route) => route.fulfill({
        status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Serveur temporairement indisponible.' }),
    }));
    await page.fill('#auth-email', 'demo@urbanflow.local');
    await page.fill('#auth-password', 'UrbanFlow2026!');
    await page.getByRole('button', { name: /ouvrir la carte/i }).click();
    await page.getByRole('alert').filter({ hasText: 'Serveur temporairement indisponible.' }).waitFor();
    assert.equal(await page.getByText('Vous êtes hors ligne.').count(), 0);
    await page.unroute('**/api/auth/login');

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('status').filter({ hasText: 'Vous êtes hors ligne.' }).waitFor();
    await page.screenshot({ path: 'tmp/screenshots/offline-rechargement.png' });
    await context.setOffline(false);
    await page.locator('#auth-email').waitFor();
    await page.fill('#auth-email', 'demo@urbanflow.local');
    await page.fill('#auth-password', 'UrbanFlow2026!');
    await page.getByRole('button', { name: /ouvrir la carte/i }).click();
    await page.locator('[data-tour="map"]').waitFor();
    const skip = page.getByRole('button', { name: /passer le tutoriel/i });
    await skip.waitFor();
    await skip.click();
    for (const width of [320, 390, 1280]) {
        await checkOffline('carte', width);
    }
    await checkOffline('carte', 844, 390);
    console.log('Bandeau hors ligne : connexion, carte, rechargement et panne serveur vérifiés.');

    // Une panne GBFS ne doit ni charger des disponibilités anciennes ni être
    // présentée comme une coupure Internet. Le contexte isole le cache du test.
    const unavailableContext = await browser.newContext({
        viewport: { width: 390, height: 844 },
        storageState: await context.storageState(),
        serviceWorkers: 'block',
    });
    // La panne opérateur est verrouillée par les tests serveur. Ici, on vérifie
    // le rendu de la réponse d'indisponibilité reçue par le navigateur.
    await unavailableContext.route('**/api/transport/context', async (route) => {
        const response = await route.fetch();
        await route.fulfill({ response, json: { ...await response.json(), sharedMobility: null } });
    });
    const unavailablePage = await unavailableContext.newPage();
    const requests = [];
    const errors = [];
    unavailablePage.on('request', (request) => requests.push(request.url()));
    unavailablePage.on('pageerror', (error) => errors.push(error.message));
    await unavailablePage.goto(baseUrl);
    const unavailableBanner = unavailablePage.getByRole('status').filter({ hasText: 'Impossible de récupérer les disponibilités Vélo’v et Dott.' });
    await unavailableBanner.waitFor();
    const skipUnavailable = unavailablePage.getByRole('button', { name: /passer le tutoriel/i });
    if (await skipUnavailable.isVisible()) await skipUnavailable.click();
    for (const width of [390, 1280]) {
        await unavailablePage.setViewportSize({ width, height: 844 });
        await unavailablePage.locator(width >= 1024 ? '[data-tour="map"]' : '[data-tour="mobile-map"]').waitFor();
        await unavailablePage.locator('.maplibregl-canvas').waitFor();
        await unavailablePage.waitForLoadState('networkidle');
        const bannerBox = await unavailableBanner.boundingBox();
        const mapBox = await unavailablePage.locator('.maplibregl-canvas').boundingBox();
        assert.ok(bannerBox && mapBox && mapBox.y >= bannerBox.y + bannerBox.height);
        assert.equal(await unavailablePage.getByText('Vous êtes hors ligne.').count(), 0);
        if (width === 1280) {
            assert.equal(await unavailablePage.getByText('Données indisponibles', { exact: true }).count(), 2);
        }
        await unavailablePage.screenshot({ path: `tmp/screenshots/gbfs-indisponible-${width}.png` });
    }
    assert.equal(requests.some((url) => url.includes('/data/shared-mobility.json')), false);
    assert.deepEqual(errors, []);
    await unavailableContext.close();
    console.log('Panne GBFS : message visible, aucun secours local, compteurs indisponibles, carte utilisable sur mobile et bureau.');
} catch (error) {
    await page.screenshot({ path: 'tmp/screenshots/offline-failure.png' });
    console.error(await page.locator('body').innerText());
    throw error;
} finally {
    await browser.close();
}
