// Le navigateur reçoit de vrais événements tactiles, en pixels écran indépendants du plateau mis à l’échelle.
import assert from 'node:assert/strict';
import { build as buildPresentation, serve } from 'bun';
import { URL } from 'node:url';
import { basename } from 'node:path';
import { chromium } from 'playwright-core';

const build = await buildPresentation({ entrypoints: ['output/presentation/index.html'], target: 'browser', minify: true });
assert(build.success, build.logs.join('\n'));
const files = new Map(build.outputs.map(file => [basename(file.path), file]));
const server = serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const file = files.get(new URL(request.url).pathname.slice(1) || 'index.html');
    return file ? new globalThis.Response(file) : new globalThis.Response('Introuvable', { status: 404 });
} });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
try {
    const context = await browser.newContext({ hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    async function gesture(from, to, cancel = false) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
        for (let step = 1; step <= 5; step++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 5, y: from.y + (to.y - from.y) * step / 5 }] });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    }
    async function at(number) {
        await page.waitForFunction(number => globalThis.location.hash === `#${number}`, number);
        assert.equal((await page.locator('.chrome-count').textContent()).trim(), `${String(number).padStart(2, '0')} / 13`);
        await page.waitForTimeout(150);
    }
    for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        await page.goto(server.url.href);
        await at(1);
        const y = viewport.height / 2;
        const right = { x: viewport.width * 0.8, y };
        const left = { x: viewport.width * 0.2, y };
        await gesture(right, left);
        await at(2);
        await gesture(left, right);
        await at(1);
        await gesture(left, right);
        await gesture(right, { x: right.x - 20, y });
        await gesture(right, { x: right.x, y: y + 80 });
        await gesture(right, left, true);
        await at(1);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [left, right] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await at(1);
        await page.goto(server.url.href + '#13');
        await at(13);
        await gesture(right, left);
        await at(13);
        await page.keyboard.press('ArrowLeft');
        await at(12);
        await page.reload();
        await at(12);
        await page.screenshot({ path: `tmp/screenshots/presentation-swipe-${viewport.width}.png` });
        console.log(`Présentation ${viewport.width} × ${viewport.height} : balayages, limites, gestes ignorés, clavier et reprise vérifiés.`);
    }
    await page.goto(server.url.href + '#10');
    const link = page.getByRole('link', { name: 'github.com/Vitrixxl/t6/pull/1', exact: true });
    const popup = context.waitForEvent('page');
    await link.tap();
    const opened = await popup;
    await opened.waitForURL('https://github.com/Vitrixxl/t6/pull/1');
    await at(10);
    await opened.close();
    console.log('Lien de PR tactile conservé, sans changement de diapositive.');
} finally {
    await browser.close();
    server.stop(true);
}
