// Graphiques alimentés par le compte réservé à la recette (bun run seed:test).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
function assert(condition, message) { if (!condition) throw new Error(message); }
try {
    const login = await context.request.post(`${baseURL}/api/auth/login`, { data: {
        email: 'test@urbanflow.local', password: process.env.TEST_PASSWORD || 'UrbanFlow2026!',
    } });
    assert(login.ok(), 'Lancer seed:test sur la base du serveur avant ce scénario.');
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /passer le tutoriel/i }).click({ timeout: 1500 }).catch(() => undefined);
    const rail = page.getByRole('group', { name: 'Actions de la carte', exact: true });
    for (const width of [320, 390, 540]) {
        await page.setViewportSize({ width, height: 844 });
        await rail.waitFor();
        assert(await rail.getByRole('button').count() === 5, 'Cinq actions attendues');
        for (const button of await rail.getByRole('button').all()) {
            const box = await button.boundingBox();
            assert(box && box.width >= 44 && box.height >= 44, 'Cible tactile trop petite');
            assert((await button.innerText()).trim().length > 0, 'Icône sans libellé visible');
        }
        const box = await rail.boundingBox();
        assert(box && box.x >= 0 && box.x + box.width <= width, 'Barre hors écran');
        await page.screenshot({ path: 'tmp/screenshots/actions-' + width + '.png' });
    }
    await rail.getByRole('button', { name: 'Couches de la carte', exact: true }).click();
    await page.getByRole('dialog', { name: 'Couches', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('[data-tour="mobile-trips"]:visible').first().click();
    const hub = page.getByRole('dialog', { name: 'Planificateur de trajets' });
    await hub.getByRole('button', { name: 'Voir l’évolution', exact: true }).click();
    const evolution = hub.locator('#trip-evolution');
    await evolution.getByText('Voir les valeurs par semaine', { exact: true }).click();
    assert(await evolution.locator('tbody tr').count() === 8, 'Huit semaines attendues');
    const current = evolution.locator('tbody tr').last();
    const carbon = await current.locator('td').nth(0).innerText();
    const spent = await hub.getByTestId('carbon-spent').innerText();
    assert(spent.replace(/\s/g, '').startsWith(carbon.replace(/\s/g, '')), 'Budget et graphique divergent');
    for (const width of [320, 390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        for (const name of ['Émissions', 'CO₂e évité', 'Distance', 'Trajets']) {
            await evolution.getByRole('button', { name, exact: true }).click();
            assert(await evolution.getByRole('button', { name, exact: true }).getAttribute('aria-pressed') === 'true', 'Indicateur inactif');
            assert((await evolution.getByRole('img').getAttribute('aria-label')).startsWith(name), 'Graphique non actualisé');
        }
        const fits = await evolution.evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
        assert(fits, `Débordement à ${width}px`);
        await evolution.getByRole('button', { name: 'Émissions', exact: true }).click();
        await evolution.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);
        await page.screenshot({ path: `tmp/screenshots/evolution-${width}.png` });
    }
    const require = createRequire(import.meta.url);
    await page.evaluate(readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'));
    const violations = await page.evaluate(async () => (await globalThis.axe.run(globalThis.document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })).violations.map((item) => item.id));
    assert(violations.length === 0, 'Accessibilité : ' + violations.join(', '));
    await hub.getByRole('button', { name: 'Masquer l’évolution', exact: true }).click();
    assert(await evolution.count() === 0, 'Le panneau reste ouvert');
    assert(errors.length === 0, errors.join('\n'));
    console.log('Évolution : 8 semaines, 4 indicateurs, cohérence budget, 320/390/1280 px, ouverture/fermeture vérifiés.');
} finally {
    await browser.close();
}
