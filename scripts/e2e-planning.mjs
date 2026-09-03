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

await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// 1. Login avec le compte seede en local (plus aucun champ prerempli dans l'UI)
await page.fill('#auth-email', 'demo@urbanflow.local');
await page.fill('#auth-password', 'UrbanFlow2026!');
await page.getByRole('button', { name: /ouvrir la carte/i }).click();
await page.waitForTimeout(4000);

// Le scenario cliquait puis annonçait "login OK" sans rien verifier : une
// limite de debit atteinte laissait donc l'ecran de connexion en place et les
// echecs suivants pointaient les mauvais coupables. La carte doit etre la.
if (!(await page.locator('#mobile-destination-search').count())) {
  const message = await page.locator('body').innerText();
  const reason = /Trop de requetes/i.test(message)
    ? 'limite de debit atteinte sur /api/auth (10 tentatives par minute)'
    : 'identifiants refuses ou API injoignable';
  console.log(`ECHEC: connexion impossible - ${reason}`);
  console.log('Relancer "bun run seed:demo" puis patienter une minute si la limite est en cause.');
  await page.screenshot({ path: 'tmp/screenshots/plan-fail-login.png' });
  process.exit(1);
}
log('login OK');

// Le tutoriel se lance a la premiere visite : on le passe pour derouler le scenario.
const skipTutorial = page.getByRole('button', { name: /passer le tutoriel/i });
if (await skipTutorial.count()) {
  await skipTutorial.first().click();
  await page.waitForTimeout(600);
  log('tutoriel passe');
}

// 2. Le depart est la position courante, sans aucune action : la barre ne
// demande qu'une destination tant qu'aucune n'est choisie.
const originValue = await page.inputValue('#mobile-destination-search').catch(() => null);
if (originValue === null) {
  console.log('ECHEC: champ de recherche unique introuvable');
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
  console.log(`ECHEC: resultat de recherche "${DEST_LABEL}" introuvable`);
  await page.screenshot({ path: 'tmp/screenshots/plan-fail-dest.png' });
  process.exit(1);
}
await destButton.click();
await page.waitForTimeout(8000);
log('destination definie, options calculees');

// La destination choisie, la barre passe a deux champs et le depart doit
// porter la position courante sans que l'utilisateur l'ait designee.
const originAfter = await page.inputValue('#mobile-origin-search').catch(() => '');
if (!originAfter) {
  failures.push('le depart n\'est pas prerempli avec la position courante');
}
log(`depart implicite : "${originAfter}"`);

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
// L'ecoute du PUT est posee avant le clic : l'envoi suit l'ecriture de pres,
// l'attendre apres coup risquerait de le manquer.
const stateSync = page
  .waitForResponse((response) => response.url().endsWith('/api/state') && response.request().method() === 'PUT', {
    timeout: 10000,
  })
  .then((response) => response.status())
  .catch(() => null);
await page.getByRole('button', { name: /^fait$/i }).first().click();
await page.waitForTimeout(1200);
text = await bodyText();
const doneCountMatch = /Fait \/ semaine\s*\n?\s*(\d+)/i.exec(text);
if (!doneCountMatch || Number(doneCountMatch[1]) < 1) {
  failures.push('le compteur "Fait / semaine" ne s\'incremente pas apres le marquage');
}
await page.screenshot({ path: 'tmp/screenshots/plan-done.png' });
log('trajet marque fait, stats mises a jour');

// 8. L'etat part au serveur sans attendre la minute de rattrapage : fermer
// l'onglet juste apres l'action ne doit rien perdre.
const syncStatus = await stateSync;
if (syncStatus !== 200) {
  failures.push(`l'etat n'est pas envoye au serveur apres le marquage (reponse : ${syncStatus ?? 'aucune'})`);
} else {
  const remote = await page.evaluate(() => fetch('/api/state').then((response) => response.json()));
  if (!remote.tripRecords?.length || !remote.plannedTrips?.length) {
    failures.push("l'etat serveur ne contient pas le trajet planifie et realise");
  }
}
log('etat synchronise avec le serveur');

// 9. Deconnexion : la session doit etre morte pour le navigateur aussi, pas
// seulement en base. Le service worker servait /api/state depuis son cache
// apres la deconnexion, et pouvait ressusciter la session d'un compte
// precedent au rechargement.
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
await page.getByRole('button', { name: /profil/i }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /^deconnexion$/i }).click();
await page.waitForTimeout(300);
const logoutResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/logout'), { timeout: 10000 });
await page.getByRole('button', { name: /^se deconnecter$/i }).click();
if ((await logoutResponse).status() !== 200) {
  failures.push('la requete de deconnexion echoue');
}
await page.waitForTimeout(300);
const stateAfterLogout = await page.evaluate(() => fetch('/api/state').then((response) => response.status));
if (stateAfterLogout !== 401) {
  failures.push(`apres deconnexion, /api/state repond encore ${stateAfterLogout} au navigateur`);
}
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
if (!(await page.locator('#auth-email').count())) {
  failures.push('apres deconnexion et rechargement, la session reapparait');
}
log('deconnexion : session morte pour le navigateur et le serveur');

await browser.close();

// Assertions bloquantes : chaque critere du scenario doit etre satisfait.
const { mkdirSync, writeFileSync } = await import('node:fs');
mkdirSync('output/metrics', { recursive: true });
writeFileSync(
  'output/metrics/e2e.json',
  JSON.stringify(
    { generatedAt: new Date().toISOString(), scenario: 'planification', assertions: 7, failures, passed: failures.length === 0 },
    null,
    2,
  ) + '\n',
);

if (failures.length > 0) {
  console.log(`ECHEC E2E (${failures.length} assertion(s)):`);
  for (const failure of failures) console.log('  - ' + failure);
  process.exit(1);
}
console.log('TEST TERMINE - 7/7 assertions passees');
