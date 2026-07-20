// Test E2E planification : recherche d'itineraire, planification datee,
// marquage "fait" et alimentation des statistiques (mobile 390x844).
import { chromium } from 'playwright-core';

const ORIGIN = { latitude: 45.7578, longitude: 4.832 };

// La destination est resolue via la BAN (meme geocodeur que l'application).
const DEST_QUERY = 'Rue de la Part-Dieu Lyon';
const banResponse = await fetch(
  `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(DEST_QUERY)}&limit=1&autocomplete=1&lat=${ORIGIN.latitude}&lon=${ORIGIN.longitude}`,
).then((res) => res.json());
const destFeature = banResponse.features?.[0];
if (!destFeature) {
  console.log('ECHEC: geocodage BAN de la destination impossible');
  process.exit(1);
}
const DEST_LABEL = destFeature.properties.label;

const CHROME_BIN =
  process.env.CHROME_BIN || process.env.CHROMIUM_PATH || '/usr/sbin/chromium';
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

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

await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// 1. Login avec le compte seede en local (plus aucun champ prerempli dans l'UI)
await page.fill('#auth-email', 'demo@urbanflow.local');
await page.fill('#auth-password', 'UrbanFlow2026!');
await page.getByRole('button', { name: /ouvrir la carte/i }).click();
await page.waitForTimeout(4000);
log('login OK');

// Le tutoriel se lance a la premiere visite : on le passe pour derouler le scenario.
const skipTutorial = page.getByRole('button', { name: /passer le tutoriel/i });
if (await skipTutorial.count()) {
  await skipTutorial.first().click();
  await page.waitForTimeout(600);
  log('tutoriel passe');
}

// 2. Depart = Ma position (GPS)
await page.click('#mobile-origin-search');
await page.waitForTimeout(800);
await page.getByRole('button', { name: /ma position/i }).first().click();
await page.waitForTimeout(2000);
log('depart GPS defini');

// 3. Destination via la recherche BAN (aucune destination preremplie)
await page.click('#mobile-destination-search');
await page.fill('#mobile-destination-search', DEST_QUERY);
await page.waitForTimeout(2500);
const destButton = page.getByRole('button', { name: DEST_LABEL }).first();
if (!(await destButton.count())) {
  console.log(`ECHEC: resultat de recherche "${DEST_LABEL}" introuvable`);
  await page.screenshot({ path: 'tmp/screenshots/plan-fail-dest.png' });
  process.exit(1);
}
await destButton.click();
await page.waitForTimeout(8000);
log('destination definie, options calculees');

// 4. Des options d'itineraire sont proposees
const bodyText = async () => page.locator('body').innerText();
let text = await bodyText();
if (!/min - [\d.,]+ km/i.test(text)) {
  failures.push("aucune option d'itineraire affichee apres la recherche");
}
await page.screenshot({ path: 'tmp/screenshots/plan-options.png' });

// 5. Planifier l'option selectionnee (dialog une fois, date par defaut)
await page.getByRole('button', { name: /^planifier$/i }).first().click();
await page.waitForTimeout(800);
const planDialogVisible = await page.locator('text=/planifier ce trajet/i').count();
if (!planDialogVisible) {
  failures.push('la fenetre "Planifier ce trajet" ne s\'ouvre pas');
}
await page.screenshot({ path: 'tmp/screenshots/plan-dialog.png' });
await page.getByRole('button', { name: /^planifier$/i }).last().click();
await page.waitForTimeout(1200);

// 6. Le hub s'ouvre sur "A venir" avec l'occurrence planifiee
text = await bodyText();
if (!/planificateur de trajets/i.test(text)) {
  failures.push("le planificateur ne s'ouvre pas apres la planification");
}
const hasUpcoming = await page.getByRole('button', { name: /^fait$/i }).count();
if (!hasUpcoming) {
  failures.push('aucune occurrence "a venir" avec action Fait');
}
await page.screenshot({ path: 'tmp/screenshots/plan-upcoming.png' });

// 7. Marquer le trajet fait -> stats et historique alimentes
await page.getByRole('button', { name: /^fait$/i }).first().click();
await page.waitForTimeout(1200);
text = await bodyText();
const doneCountMatch = /Fait \/ semaine\s*\n?\s*(\d+)/i.exec(text);
if (!doneCountMatch || Number(doneCountMatch[1]) < 1) {
  failures.push('le compteur "Fait / semaine" ne s\'incremente pas apres le marquage');
}
await page.screenshot({ path: 'tmp/screenshots/plan-done.png' });
log('trajet marque fait, stats mises a jour');

await browser.close();

// Assertions bloquantes : chaque critere du scenario doit etre satisfait.
const { mkdirSync, writeFileSync } = await import('node:fs');
mkdirSync('output/metrics', { recursive: true });
writeFileSync(
  'output/metrics/e2e.json',
  JSON.stringify(
    { generatedAt: new Date().toISOString(), scenario: 'planification', assertions: 5, failures, passed: failures.length === 0 },
    null,
    2,
  ) + '\n',
);

if (failures.length > 0) {
  console.log(`ECHEC E2E (${failures.length} assertion(s)):`);
  for (const failure of failures) console.log('  - ' + failure);
  process.exit(1);
}
console.log('TEST TERMINE - 5/5 assertions passees');
