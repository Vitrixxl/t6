// Vérifie que Scalar s'affiche sans blocage CSP et que le JSON reste protégé.
import { chromium } from 'playwright-core';
const base = process.env.E2E_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
try {
    await page.addInitScript(() => {
        globalThis.cspViolations = [];
        globalThis.document.addEventListener('securitypolicyviolation', event => {
            globalThis.cspViolations.push(`${event.effectiveDirective}: ${event.blockedURI}`);
        });
    });
    for (const path of ['/api/doc', '/api/doc/']) {
        await page.goto(base + path);
        await page.getByRole('heading', { name: 'API UrbanFlow Mobility', exact: true }).waitFor({ timeout: 60000 });
        await page.getByText('/api/health', { exact: true }).first().waitFor();
        const violations = await page.evaluate(() => globalThis.cspViolations);
        if (violations.length) throw new Error(`Blocages CSP : ${violations.join(', ')}`);
    }
    const schema = await page.request.get(base + '/api/doc/json');
    if (schema.headers()['content-security-policy'] !== "default-src 'none'; frame-ancestors 'none'") throw new Error('La politique JSON a changé');
    await page.screenshot({ path: 'tmp/screenshots/api-doc.png' });
    console.log('Scalar visible, routes chargées, aucun blocage CSP ; schéma JSON toujours protégé.');
} finally {
    await browser.close();
}
