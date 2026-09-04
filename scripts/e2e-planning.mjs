// Test E2E planification : recherche d'itinéraire, planification datée,
// marquage "fait" et alimentation des statistiques (mobile 390x844).
import { chromium } from 'playwright-core';

const ORIGIN = { latitude: 45.7578, longitude: 4.832 };

// La destination est resolue via la BAN (même géocodeur que l'application).
const DEST_QUERY = 'Rue de la Part-Dieu Lyon';
const banResponse = await fetch(
    `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(DEST_QUERY)}&limit=1&autocomplete=1&lat=${ORIGIN.latitude}&lon=${ORIGIN.longitude}`,
).then((res) => res.json());
const destFeature = banResponse.features?.[0];
if (!destFeature) {
    console.log('ÉCHEC: géocodage BAN de la destination impossible');
    process.exit(1);
}
const DEST_LABEL = destFeature.properties.label;

const CHROME_BIN =
    process.env.CHROME_BIN || process.env.CHROMIUM_PATH || '/usr/sbin/chromium';
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:4000';

const browser = await chromium.launch({
    executablePath: CHROME_BIN,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=2'],
});
const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    geolocation: ORIGIN,
    permissions: ['geolocation'],
});
const page = await context.newPage();
page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

const log = (...args) => console.log('•', ...args);
const failures = [];

const MOBILE_TUTORIAL_STEPS = [
    { title: 'Bienvenue sur UrbanFlow' },
    { title: 'Recherche départ / arrivée', target: 'mobile-search' },
    { title: 'La carte', target: 'mobile-map' },
    { title: 'Ta position', target: 'mobile-location' },
    { title: 'Autour de moi', target: 'mobile-nearby' },
    { title: 'Couches temps réel', target: 'mobile-layers' },
    { title: 'Trajets et objectifs', target: 'mobile-trips' },
    { title: 'Profil et préférences', target: 'mobile-profile' },
    { title: "C'est tout !" },
];

function overlapArea(a, b) {
    const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return width * height;
}

async function testMobileSheet() {
    const sheet = page.locator('[data-tour="routes"]:visible');
    const controls = page.getByRole('group', { name: 'Taille du panneau trajets' });
    const sizes = [
        { name: 'Réduire le panneau : carte', level: 'collapsed', ratio: 0.30 },
        { name: 'Taille moyenne du panneau : aperçu', level: 'mid', ratio: 0.54 },
        { name: 'Agrandir le panneau : détails', level: 'expanded', ratio: 0.82 },
    ];
    for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        for (const size of sizes) {
            const button = controls.getByRole('button', { name: size.name });
            await button.click();
            await page.waitForTimeout(350);
            const box = await sheet.boundingBox();
            if (await sheet.getAttribute('data-sheet-level') !== size.level || !box || Math.abs(box.height - 844 * size.ratio) > 2) {
                failures.push(`panneau ${width}px : taille ${size.level} incorrecte`);
            }
            const buttonBox = await button.boundingBox();
            if (!buttonBox || buttonBox.height < 44 || buttonBox.width < 44) {
                failures.push(`panneau ${width}px : cible tactile trop petite`);
            }
        }
        const content = sheet.locator('[id]').first();
        await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        await controls.getByRole('button', { name: sizes[0].name }).click();
        await controls.getByRole('button', { name: sizes[2].name }).click();
        await content.evaluate((element) => { element.scrollTop = 0; });
        await page.waitForTimeout(350);
        await page.screenshot({ path: `tmp/screenshots/routes-expanded-${width}.png` });
    }
    const handle = page.getByTestId('mobile-trip-sheet-handle');
    await handle.focus();
    await page.keyboard.press('ArrowDown');
    if (await sheet.getAttribute('data-sheet-level') !== 'mid') failures.push('panneau : réduction au clavier impossible');
    await page.keyboard.press('Enter');
    if (await sheet.getAttribute('data-sheet-level') !== 'expanded') failures.push('panneau : agrandissement au clavier impossible');
    await page.waitForTimeout(350);
    const grip = await handle.boundingBox();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 80, { steps: 8 });
    await page.mouse.up();
    if (await sheet.getAttribute('data-sheet-level') !== 'mid') failures.push('panneau : glissement vers le bas incorrect');
    await controls.getByRole('button', { name: sizes[2].name }).click();
    const choices = page.getByRole('group', { name: 'Options d’itinéraire', exact: true }).getByRole('button');
    for (const choice of await choices.all()) {
        await choice.click();
        if (await choice.getAttribute('aria-pressed') !== 'true') failures.push('option mobile impossible à sélectionner');
    }
    log('panneau mobile : trois tailles, défilement, clavier, glissement et sélection vérifiés à 320 et 390 px');
}

async function testMobileTutorial() {
    const dialog = page.getByRole('dialog', { name: 'Tutoriel UrbanFlow' });
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    for (const [index, expected] of MOBILE_TUTORIAL_STEPS.entries()) {
        const title = await dialog.getByRole('heading', { level: 2 }).textContent();
        if (title !== expected.title) {
            failures.push(`tutoriel mobile : étape ${index + 1}, "${expected.title}" attendu, "${title ?? 'aucun titre'}" obtenu`);
            return false;
        }

        if (expected.target) {
            const target = page.locator(`[data-tour="${expected.target}"]:visible`).first();
            if (!(await target.count())) {
                failures.push(`tutoriel mobile : la cible ${expected.target} n'est pas visible`);
                return false;
            }
            const targetBox = await target.boundingBox();
            const cardBox = await dialog.getByTestId('tutorial-card').boundingBox();
            if (!targetBox) {
                failures.push(`tutoriel mobile : la cible ${expected.target} n'est pas visible`);
                return false;
            }
            if (expected.target !== 'mobile-map' && cardBox && overlapArea(targetBox, cardBox) > 0) {
                failures.push(`tutoriel mobile : l'explication masque la cible ${expected.target}`);
                return false;
            }
            if (expected.target === 'mobile-map' || expected.target === 'mobile-trips') {
                await page.screenshot({ path: `tmp/screenshots/tutorial-${expected.target}.png` });
            }
        }

        const last = index === MOBILE_TUTORIAL_STEPS.length - 1;
        await dialog.getByRole('button', { name: last ? 'Terminer' : 'Suivant' }).click();
        await page.waitForTimeout(350);
    }
    return true;
}

await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// 1. Login avec le compte seede en local (plus aucun champ prérempli dans l'UI)
await page.fill('#auth-email', 'demo@urbanflow.local');
await page.fill('#auth-password', 'UrbanFlow2026!');
await page.getByRole('button', { name: /ouvrir la carte/i }).click();
await page.waitForTimeout(4000);

// Le scénario cliquait puis annonçait "login OK" sans rien verifier : une
// limite de débit atteinte laissait donc l'écran de connexion en place et les
// échecs suivants pointaient les mauvais coupables. La carte doit être la.
if (!(await page.locator('#mobile-destination-search').count())) {
    const message = await page.locator('body').innerText();
    const reason = /Trop de requêtes/i.test(message)
        ? 'limite de débit atteinte sur /api/auth (10 tentatives par minute)'
        : 'identifiants refuses ou API injoignable';
    console.log(`ÉCHEC: connexion impossible - ${reason}`);
    console.log('Relancer "bun run seed:demo" puis patienter une minute si la limite est en cause.');
    await page.screenshot({ path: 'tmp/screenshots/plan-fail-login.png' });
    process.exit(1);
}
log('login OK');

// Le tutoriel de première visite doit montrer les fonctions réellement
// disponibles sur mobile, sans poser sa carte d'explication sur leur bouton.
if (await testMobileTutorial()) {
    log('tutoriel mobile complet et lisible');
} else {
    console.log(`ÉCHEC: ${failures.at(-1)}`);
    await page.screenshot({ path: 'tmp/screenshots/tutorial-mobile-fail.png' });
    const skipTutorial = page.getByRole('button', { name: /passer le tutoriel/i });
    if (await skipTutorial.count()) {
        await skipTutorial.first().evaluate((button) => button.click());
    }
}

// 2. Le départ est la position courante, sans aucune action : la barre ne
// demande qu'une destination tant qu'aucune n'est choisie.
const originValue = await page.inputValue('#mobile-destination-search').catch(() => null);
if (originValue === null) {
    console.log('ÉCHEC: champ de recherche unique introuvable');
    await page.screenshot({ path: 'tmp/screenshots/plan-fail-search.png' });
    process.exit(1);
}
log('barre de recherche en mode destination seule');

// 3. Destination via la recherche BAN (aucune destination preremplie)
await page.click('#mobile-destination-search');
await page.fill('#mobile-destination-search', DEST_QUERY);
await page.waitForTimeout(2500);
const destButton = page.getByRole('button', { name: DEST_LABEL }).first();
if (!(await destButton.count())) {
    console.log(`ÉCHEC: résultat de recherche "${DEST_LABEL}" introuvable`);
    await page.screenshot({ path: 'tmp/screenshots/plan-fail-dest.png' });
    process.exit(1);
}
await destButton.click();
// Le routage réel peut depasser huit secondes quand l'instance publique est
// chargée. On attend l'état fonctionnel plutôt qu'un délai arbitraire.
await page.getByRole('button', { name: /^planifier$/i }).first().waitFor({
    state: 'visible',
    timeout: 30000,
});
log('destination définie, options calculées');

// La destination choisie, la barre passe a deux champs et le départ doit
// porter la position courante sans que l'utilisateur l'ait désignée.
const originAfter = await page.inputValue('#mobile-origin-search').catch(() => '');
if (!originAfter) {
    failures.push('le départ n\'est pas prérempli avec la position courante');
}
log(`départ implicite : "${originAfter}"`);

// 4. Des options d'itinéraire sont proposées
const bodyText = async () => page.locator('body').innerText();
let text = await bodyText();
if (!/(?:min|h\d{2}) - [\d.,]+ km/i.test(text)) {
    failures.push("aucune option d'itinéraire affichée après la recherche");
}
await page.screenshot({ path: 'tmp/screenshots/plan-options.png' });
await testMobileSheet();

// 5. Planifier l'option sélectionnée (dialog une fois, date par défaut)
await page.getByRole('button', { name: /^planifier$/i }).first().click();
await page.waitForTimeout(800);
const planDialogVisible = await page.locator('text=/planifier ce trajet/i').count();
if (!planDialogVisible) {
    failures.push('la fenêtre "Planifier ce trajet" ne s\'ouvre pas');
}
await page.screenshot({ path: 'tmp/screenshots/plan-dialog.png' });
await page.getByRole('button', { name: /^planifier$/i }).last().click();
await page.waitForTimeout(1200);

// 6. Le hub s'ouvre sur "À venir" avec l'occurrence planifiee
text = await bodyText();
if (!/planificateur de trajets/i.test(text)) {
    failures.push("le planificateur ne s'ouvre pas après la planification");
}
if (!(await page.getByRole('button', { name: 'Modifier les objectifs', exact: true }).count())) {
    failures.push("l'action des objectifs n'indique pas explicitement ce qu'elle modifie");
}
const hasUpcoming = await page.getByRole('button', { name: /^fait$/i }).count();
if (!hasUpcoming) {
    failures.push('aucune occurrence "à venir" avec action Fait');
}
await page.screenshot({ path: 'tmp/screenshots/plan-upcoming.png' });

// 7. Marquer le trajet fait -> stats et historique alimentés
// L'écoute du PUT est posee avant le clic : la commande atomique suit l'action
// de près. Le serveur termine le trajet et crée son historique dans la même
// transaction ; le navigateur n'envoie aucune collection.
const stateSync = page
    .waitForResponse((response) => response.url().endsWith('/completion') && response.request().method() === 'PUT', {
        timeout: 10000,
    })
    .then((response) => response.status())
    .catch(() => null);
await page.getByRole('button', { name: /^fait$/i }).first().click();
await page.waitForTimeout(1200);
text = await bodyText();
const doneCountMatch = /Fait \/ semaine\s*\n?\s*(\d+)/i.exec(text);
if (!doneCountMatch || Number(doneCountMatch[1]) < 1) {
    failures.push('le compteur "Fait / semaine" ne s\'incremente pas après le marquage');
}
await page.screenshot({ path: 'tmp/screenshots/plan-done.png' });
log('trajet marqué fait, stats mises à jour');

// 8. La commande part au serveur dès l'action : fermer l'onglet juste après
// ne doit rien perdre.
const syncStatus = await stateSync;
if (syncStatus !== 200) {
    failures.push(`la complétion n'est pas enregistrée par le serveur (réponse : ${syncStatus ?? 'aucune'})`);
} else {
    const remote = await page.evaluate(() => fetch('/api/state').then((response) => response.json()));
    if (!remote.tripRecords?.length || !remote.plannedTrips?.length) {
        failures.push("l'état serveur ne contient pas le trajet planifié et realise");
    }
}
log('complétion enregistrée sur le serveur');

// 9. Déconnexion : la session doit être morte pour le navigateur aussi, pas
// seulement en base. Le service worker servait /api/state depuis son cache
// après la déconnexion, et pouvait ressusciter la session d'un compte
// précédent au rechargement.
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.getByRole('button', { name: /profil/i }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /^déconnexion$/i }).click();
await page.waitForTimeout(300);
const logoutResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/logout'), { timeout: 10000 });
await page.getByRole('button', { name: /^se déconnecter$/i }).click();
if ((await logoutResponse).status() !== 200) {
    failures.push('la requête de déconnexion echoue');
}
await page.waitForTimeout(300);
const stateAfterLogout = await page.evaluate(() => fetch('/api/state').then((response) => response.status));
if (stateAfterLogout !== 401) {
    failures.push(`après déconnexion, /api/state répond encore ${stateAfterLogout} au navigateur`);
}
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
if (!(await page.locator('#auth-email').count())) {
    failures.push('après déconnexion et rechargement, la session reapparaît');
}
log('déconnexion : session morte pour le navigateur et le serveur');

await browser.close();

// Assertions bloquantes : chaque critère du scénario doit être satisfait.
const { mkdirSync, writeFileSync } = await import('node:fs');
mkdirSync('output/metrics', { recursive: true });
writeFileSync(
    'output/metrics/e2e.json',
    JSON.stringify(
        { generatedAt: new Date().toISOString(), scenario: 'planification', assertions: 9, failures, passed: failures.length === 0 },
        null,
        2,
    ) + '\n',
);

if (failures.length > 0) {
    console.log(`ÉCHEC E2E (${failures.length} assertion(s)):`);
    for (const failure of failures) console.log('  - ' + failure);
    process.exit(1);
}
console.log('TEST TERMINE - 9/9 assertions passées');
