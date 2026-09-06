// Une navigation en ligne doit charger la livraison courante, même avec un ancien HTML en cache.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const base = process.env.E2E_BASE_URL || 'https://localhost:4102';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox', '--ignore-certificate-errors'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);
try {
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(globalThis.navigator.serviceWorker.controller));
    await page.evaluate(async () => {
        const cacheName = (await globalThis.caches.keys()).find(name => name.startsWith('urbanflow-shell-'));
        if (!cacheName) throw new Error('Cache applicatif absent');
        const cache = await globalThis.caches.open(cacheName);
        const current = await globalThis.fetch('/', { cache: 'reload' });
        const html = (await current.text()).replace('<html', '<html data-obsolete="true"');
        for (const path of ['/', '/index.html']) {
            await cache.put(path, new globalThis.Response(html, { headers: { 'Content-Type': 'text/html' } }));
        }
    });
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('html').getAttribute('data-obsolete'), null, 'Le premier rechargement sert encore la livraison en cache');
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('html').getAttribute('data-obsolete'), null, 'Le cache hors ligne garde l’ancienne livraison');
    await page.getByRole('status').filter({ hasText: 'Vous êtes hors ligne.' }).waitFor();
    await context.setOffline(false);
    await page.reload({ waitUntil: 'load' });
    assert.equal(await page.locator('html').getAttribute('data-obsolete'), null);
    console.log('Premier rechargement actualisé, cache renouvelé et reprise hors ligne vérifiés.');
} finally {
    await browser.close();
}
