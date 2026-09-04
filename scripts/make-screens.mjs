// Genere l'ensemble des captures du dossier (output/screens/) sur l'application
// en fonctionnement reel. Reproductible : bun run screens (serveur sur 5173 ou
// SCREENS_BASE_URL).
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.SCREENS_BASE_URL || 'http://localhost:4000';
const CHROME_BIN = process.env.CHROME_BIN || process.env.CHROMIUM_PATH || '/usr/sbin/chromium';
const OUT = 'output/screens';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
    executablePath: CHROME_BIN,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=2'],
});

function makeContext(mobile) {
    return browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
        deviceScaleFactor: 2,
        isMobile: mobile,
        hasTouch: mobile,
        locale: 'fr-FR',
        geolocation: { latitude: 45.7578, longitude: 4.832 },
        permissions: ['geolocation'],
    });
}

async function login(page) {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    if (await page.locator('#auth-email').count()) {
        await page.fill('#auth-email', 'demo@urbanflow.local');
        await page.fill('#auth-password', 'UrbanFlow2026!');
        await page.getByRole('button', { name: /ouvrir la carte/i }).click();
        await page.waitForTimeout(4000);
    }
    const skip = page.getByRole('button', { name: /passer le tutoriel/i });
    if (await skip.count()) {
        await skip.first().click();
        await page.waitForTimeout(600);
    }
    await page.waitForTimeout(3500);
}

// La destination est saisie en premier : sur mobile, la barre ne montre qu'un
// champ tant qu'aucune destination n'est choisie, et le depart n'apparait
// qu'ensuite. Cet ordre fonctionne aussi sur bureau, ou les deux champs
// coexistent des le depart.
async function planRoute(page, originQuery, destQuery, destPattern, prefix) {
    await page.click(`#${prefix}-destination-search`);
    await page.fill(`#${prefix}-destination-search`, destQuery);
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: destPattern }).first().click();
    await page.waitForTimeout(1200);
    await page.click(`#${prefix}-origin-search`);
    await page.fill(`#${prefix}-origin-search`, originQuery);
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: /Place Bellecour 69002/ }).first().click();
    await page.waitForTimeout(7000);
}

const shot = (page, name, options = {}) => page.screenshot({ path: `${OUT}/${name}`, ...options });

// --- Desktop -----------------------------------------------------------------
{
    const context = await makeContext(false);
    const page = await context.newPage();

    // 01. Authentification
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    await shot(page, '01-auth-desktop.png');
    await shot(page, '01-auth-desktop-crop.png', { clip: { x: 480, y: 210, width: 960, height: 660 } });

    // 03. Planification Bellecour -> Part-Dieu
    await login(page);
    await planRoute(page, 'place bellecour lyon', 'gare part dieu lyon', /Gare/, 'desktop-origin'.replace('-origin', ''));
    await shot(page, '03-planner-desktop.png');

    // 04. Hub planificateur : routine creee (ses passages echus comptent d'eux-memes)
    // et, s'il existe un trajet date, marquage fait -> objectifs alimentes
    await page.getByRole('button', { name: /^planifier$/i }).first().click();
    await page.waitForTimeout(700);
    await page.getByRole('tab', { name: /recurrent/i }).click();
    await page.waitForTimeout(400);
    await page.fill('#plan-label', 'Aller-retour travail');
    await page.getByRole('button', { name: /creer la routine/i }).click();
    await page.waitForTimeout(1200);
    const fait = page.getByRole('button', { name: /^fait$/i }).first();
    await page.getByRole('tab', { name: /a venir/i }).click();
    await page.waitForTimeout(400);
    if (await fait.count()) {
        await fait.click();
        await page.waitForTimeout(900);
    }
    await shot(page, '04-planificateur-desktop.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    // 05. Profil
    await page.getByRole('button', { name: /ouvrir le profil/i }).first().click();
    await page.waitForTimeout(1400);
    await shot(page, '05-profile-desktop.png');
    await context.close();
}

// --- Mobile ------------------------------------------------------------------
{
    const context = await makeContext(true);
    const page = await context.newPage();

    // 02. Authentification mobile
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    await shot(page, '02-auth-mobile.png');

    // 06. Options d'itineraire mobile (feuille glissable)
    await login(page);
    await planRoute(page, 'place bellecour lyon', 'gare part dieu lyon', /Gare/, 'mobile');
    await shot(page, '06-planner-mobile.png');

    // 07. Hub planificateur mobile (objectifs + a venir). Sur mobile, la feuille
    // d'options recouvre la barre d'actions : c'est son entete qui porte l'acces.
    await page.getByRole('button', { name: /mes trajets/i }).first().click();
    await page.waitForTimeout(1200);
    await shot(page, '07-hub-mobile.png');
    await context.close();
}

await browser.close();
console.log(`captures generees dans ${OUT}/`);
