// Test E2E navigation mobile : simulation d'un deplacement GPS Bellecour -> Part-Dieu.
import { chromium } from 'playwright-core';

const ORIGIN = { latitude: 45.7578, longitude: 4.832 };
const DEST = { latitude: 45.7606, longitude: 4.8594 };

const CHROME_BIN =
  process.env.CHROME_BIN || process.env.CHROMIUM_PATH || '/usr/sbin/chromium';

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

await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// 1. Login demo
await page.getByRole('button', { name: /ouvrir la carte/i }).click();
await page.waitForTimeout(5000);
log('login OK');

// 2. Depart = Ma position (GPS)
const originInput = page.locator('input:visible').first();
await originInput.click();
await originInput.fill('Bellecour');
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /ma position/i }).first().click();
await page.waitForTimeout(8000);
log('depart GPS defini, trajets calcules');

// 3. Demarrer la navigation
const startBtn = page.getByRole('button', { name: /commencer le trajet/i });
if (!(await startBtn.count())) {
  console.log('ECHEC: bouton "Commencer le trajet" introuvable');
  await page.screenshot({ path: 'tmp/screenshots/nav-fail-start.png' });
  process.exit(1);
}
await startBtn.click();
await page.waitForTimeout(2500);

const guidance = () => page.locator('text=GUIDAGE EN COURS').first();
if (!(await guidance().count())) {
  console.log('ECHEC: panneau GUIDAGE EN COURS absent apres demarrage');
  await page.screenshot({ path: 'tmp/screenshots/nav-fail-guidance.png' });
  process.exit(1);
}
log('navigation demarree, guidage affiche');

async function readPanel() {
  const text = await page.locator('body').innerText();
  const reste = text.match(/RESTE\s*\n?([\d]+ min)/i)?.[1] ?? '?';
  const prog = text.match(/PROGRESSION\s*\n?(\d+)\s*%/i)?.[1] ?? '?';
  const instr = (await page.locator('section:has-text("GUIDAGE EN COURS") h2, [class*=guidage]').first().textContent().catch(() => '?')) ?? '?';
  return { reste, prog, instr: instr.trim().slice(0, 60) };
}

console.log('  etat initial:', JSON.stringify(await readPanel()));

// 4. Simulation du deplacement en 6 etapes
let lastProg = -1;
let monotone = true;
for (let step = 1; step <= 6; step += 1) {
  const t = step / 6;
  await context.setGeolocation({
    latitude: ORIGIN.latitude + (DEST.latitude - ORIGIN.latitude) * t,
    longitude: ORIGIN.longitude + (DEST.longitude - ORIGIN.longitude) * t,
  });
  await page.waitForTimeout(2200);
  const state = await readPanel();
  console.log(`  etape ${step}/6 (t=${t.toFixed(2)}):`, JSON.stringify(state));
  const progNum = Number(state.prog);
  if (!Number.isNaN(progNum)) {
    if (progNum < lastProg) monotone = false;
    lastProg = progNum;
  }
  if (step === 3) await page.screenshot({ path: 'tmp/screenshots/nav-mid.png' });
}
await page.screenshot({ path: 'tmp/screenshots/nav-arrival.png' });
log(`progression monotone: ${monotone}, progression finale: ${lastProg}%`);

// 5. Quitter la navigation -> modal de confirmation
await page.getByRole('button', { name: /quitter|terminer/i }).first().click();
await page.waitForTimeout(1000);
const modalConfirm = page.getByRole('button', { name: /oui|confirmer|quitter/i });
const modalVisible = await page.locator('text=/quitter la navigation|arreter le guidage|sortir/i').count();
await page.screenshot({ path: 'tmp/screenshots/nav-exit-modal.png' });
log('modal de sortie affichee:', modalVisible > 0 ? 'oui' : 'NON (a verifier sur capture)');
const confirmBtn = page.locator('[role="dialog"] button, [data-state="open"] button').filter({ hasText: /oui|quitter|confirmer|arreter/i }).last();
if (await confirmBtn.count()) {
  await confirmBtn.click();
  await page.waitForTimeout(1500);
}
const backToPlanning = await page.locator('text=TRAJETS DISPONIBLES').count();
log('retour a la planification apres sortie:', backToPlanning > 0 ? 'oui' : 'NON');
await page.screenshot({ path: 'tmp/screenshots/nav-after-exit.png' });

await browser.close();
console.log('TEST TERMINE');
