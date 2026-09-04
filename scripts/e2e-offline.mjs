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
} finally {
    await browser.close();
}
