// Premier accueil, refus serveur récupérable et préférences persistées sur mobile et bureau.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
const base = process.env.E2E_BASE_URL || 'http://localhost:4000';
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/sbin/chromium', args: ['--no-sandbox'] });
try {
    for (const width of [320, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
        const page = await context.newPage();
        try {
            const registered = await context.request.post(base + '/api/auth/register', { data: {
                email: `onboarding-${randomUUID()}@example.test`, password: 'Onboarding2026!', displayName: 'Accueil', termsAccepted: true,
            } });
            assert.equal(registered.status(), 201);
            await page.goto(base);
            const dialog = page.getByRole('dialog', { name: 'Bienvenue sur UrbanFlow', exact: true });
            await dialog.waitFor();
            await page.keyboard.press('Escape');
            assert(await dialog.isVisible(), 'Échap ne doit pas valider l’accueil');
            assert.equal(await page.getByRole('dialog', { name: 'Tutoriel UrbanFlow' }).count(), 0);
            for (const name of ['Vélo’v', 'Dott']) await dialog.getByRole('button', { name, exact: true }).click();
            await dialog.getByRole('checkbox', { name: /mobilité réduite/ }).check();
            await page.route('**/api/me/profile', async route => {
                if (route.request().method() === 'PUT') return route.fulfill({ status: 503, json: { error: 'Enregistrement indisponible.' } });
                return route.continue();
            });
            await dialog.getByRole('button', { name: 'Commencer' }).click();
            await dialog.getByRole('alert').waitFor();
            assert(await dialog.getByRole('button', { name: 'Commencer' }).isEnabled(), 'Le refus doit permettre de réessayer');
            assert.equal((await (await context.request.get(base + '/api/me/profile')).json()).onboardedAt, null);
            await page.screenshot({ path: `tmp/screenshots/onboarding-error-${width}.png` });
            await page.unroute('**/api/me/profile');
            await dialog.getByRole('button', { name: 'Commencer' }).click();
            await dialog.waitFor({ state: 'hidden' });
            const profile = await (await context.request.get(base + '/api/me/profile')).json();
            assert.deepEqual(profile.availableModes, ['transit']);
            assert.equal(profile.accessibilityNeed, true);
            assert(Number.isFinite(Date.parse(profile.onboardedAt)));
            await page.getByRole('button', { name: /passer le tutoriel/i }).click();
            await page.reload();
            await page.locator('.maplibregl-canvas').waitFor();
            assert.equal(await dialog.count(), 0, 'L’accueil terminé ne doit pas revenir');
            await page.getByRole('button', { name: /ouvrir le profil|profil et préférences/i }).first().click();
            const drawer = page.getByRole('dialog', { name: 'Profil et préférences', exact: true });
            assert.equal(await drawer.getByRole('button', { name: 'Vélo’v', exact: true }).getAttribute('aria-pressed'), 'false');
            assert(await drawer.getByRole('checkbox', { name: 'Priorité PMR' }).isChecked());
            await page.route('**/api/me/profile', async route => {
                if (route.request().method() === 'PUT') return route.fulfill({ status: 503, json: { error: 'Profil refusé.' } });
                return route.continue();
            });
            const save = drawer.getByRole('button', { name: 'Enregistrer', exact: true });
            const refused = page.waitForResponse(response => response.url().endsWith('/api/me/profile') && response.request().method() === 'PUT');
            await save.click();
            assert.equal((await refused).status(), 503);
            assert.equal(await save.locator('.lucide-check').count(), 0, 'Un refus ne doit pas afficher le succès');
            await page.unroute('**/api/me/profile');
            await save.click();
            await save.locator('.lucide-check').waitFor();
            await page.screenshot({ path: `tmp/screenshots/onboarding-profile-${width}.png` });
            console.log(`Accueil ${width}px : choix, PMR, échec, nouvel essai et persistance vérifiés.`);
        } finally {
            await context.request.delete(base + '/api/me');
            await context.close();
        }
    }
} finally { await browser.close(); }
