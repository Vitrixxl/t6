// Recette du transfert TCL : aucun fichier global, cellules réutilisées et
// erreurs visibles. Les scénarios de planification vérifient le réseau complet.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const base = process.env.E2E_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 850 }, ignoreHTTPSErrors: true, locale: 'fr-FR' });
const page = await context.newPage();
const requests = [];
const cells = [];
const errors = [];
page.on('request', request => requests.push(request.url()));
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
    if (response.url().includes('/api/transport/stops?')) cells.push(response);
});
try {
    const login = await context.request.post(`${base}/api/auth/login`, { data: { email: 'demo@urbanflow.local', password: 'UrbanFlow2026!' } });
    assert.ok(login.ok(), 'Connexion de recette refusée');
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /passer le tutoriel/i }).click({ timeout: 1500 }).catch(() => undefined);
    await page.locator('.maplibregl-canvas').waitFor();
    await page.waitForTimeout(700);
    assert.equal(requests.some(url => url.includes('/data/gtfs-feed.json')), false, 'Le navigateur télécharge encore tout le réseau TCL');
    assert.ok(cells.length > 0, 'Aucune cellule TCL chargée');
    const initialCells = cells.length;
    const canvas = await page.locator('.maplibregl-canvas').boundingBox();
    assert.ok(canvas);
    const left = canvas.x + canvas.width * 0.2;
    const right = canvas.x + canvas.width * 0.8;
    const middle = canvas.y + canvas.height * 0.45;
    const initialBytes = (await Promise.all(cells.map(async response => (await response.body()).byteLength))).reduce((a, b) => a + b, 0);
    const transferredBytes = (await Promise.all(cells.map(async response => (await response.request().sizes()).responseBodySize))).reduce((a, b) => a + b, 0);
    assert.ok(transferredBytes < initialBytes, 'Les cellules ne sont pas compressées sur le réseau');
    assert.ok(initialBytes < 500_000, `Trop de données TCL à l’ouverture : ${initialBytes}`);
    assert.equal(await page.getByText('Certains arrêts TCL n’ont pas pu être chargés.', { exact: false }).count(), 0);
    await page.mouse.move(right, middle);
    await page.mouse.down();
    await page.mouse.move(left, middle, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await page.mouse.move(left, middle);
    await page.mouse.down();
    await page.mouse.move(right, middle, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    const urls = requests.filter(url => url.includes('/api/transport/stops?'));
    assert.ok(urls.length > initialCells, 'Le déplacement n’a pas atteint de nouvelle cellule');
    assert.equal(new Set(urls).size, urls.length, 'Une cellule a été redemandée pendant le retour sur la carte');
    for (let index = 0; index < 4; index++) {
        await page.locator('.maplibregl-ctrl-zoom-out').click();
        await page.waitForTimeout(400);
    }
    await page.getByText('Zoomez pour afficher les arrêts TCL.').waitFor();
    await page.waitForTimeout(500);
    const before = requests.filter(url => url.includes('/api/transport/stops?')).length;
    await page.mouse.move(right, middle);
    await page.mouse.down();
    await page.mouse.move(left, middle, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(1000);
    assert.equal(requests.filter(url => url.includes('/api/transport/stops?')).length, before, 'Des quais invisibles sont téléchargés au zoom régional');
    await mkdir('tmp/screenshots', { recursive: true });
    await page.screenshot({ path: 'tmp/screenshots/transport-map-region.png' });
    await page.route('**/api/transport/stops?**', route => route.abort());
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('status').filter({ hasText: 'Certains arrêts TCL n’ont pas pu être chargés.' }).waitFor();
    await page.unroute('**/api/transport/stops?**');
    await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Certains arrêts TCL n’ont pas pu être chargés.' }).waitFor({ state: 'hidden' });
    await page.screenshot({ path: 'tmp/screenshots/transport-map-loaded.png' });
    assert.deepEqual(errors, []);
    console.log(`Carte TCL : ${transferredBytes} octets transférés pour ${initialBytes} octets JSON de cellules à l’ouverture, ${urls.length} cellules uniques après aller-retour ; zoom régional sans requête, panne et reprise vérifiés.`);
} finally { await browser.close(); }
