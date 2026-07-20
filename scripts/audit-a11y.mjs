// Audit d'accessibilite automatise axe-core (WCAG 2.1 A/AA) sur le build de
// production servi par `vite preview`. Trois etats sont audites : l'ecran
// d'authentification, l'ecran principal carte/planification et le profil.
// Limite assumee : axe-core ne remplace pas un audit manuel clavier + lecteur
// d'ecran ; il detecte les violations programmatiquement verifiables.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const AXE_SOURCE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE_URL = process.env.AUDIT_BASE_URL || 'http://localhost:4173';
const CHROME_BIN = process.env.CHROME_BIN || process.env.CHROMIUM_PATH || '/usr/sbin/chromium';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const browser = await chromium.launch({
  executablePath: CHROME_BIN,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: 'fr-FR',
  geolocation: { latitude: 45.7578, longitude: 4.832 },
  permissions: ['geolocation'],
});
const page = await context.newPage();

async function runAxe(label) {
  await page.evaluate(AXE_SOURCE);
  const results = await page.evaluate(
    async (tags) => await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    TAGS,
  );
  console.log(`\n=== ${label} ===`);
  console.log(`regles executees: ${results.passes.length + results.violations.length + results.incomplete.length}`);
  console.log(`conformes: ${results.passes.length} | violations: ${results.violations.length} | a verifier manuellement: ${results.incomplete.length}`);
  for (const violation of results.violations) {
    console.log(`  [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes.length} noeud(s))`);
    for (const node of violation.nodes.slice(0, 3)) {
      console.log(`    -> ${node.target.join(' ')}`);
    }
  }
  return results.violations.length;
}

let totalViolations = 0;

await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
totalViolations += await runAxe('Ecran authentification (mobile)');

await page.getByRole('button', { name: /ouvrir la carte/i }).click();
await page.waitForTimeout(6000);
totalViolations += await runAxe('Ecran principal carte + planification (mobile)');

const profileButton = page.getByRole('button', { name: /profil/i }).first();
if (await profileButton.count()) {
  await profileButton.click();
  await page.waitForTimeout(1200);
  totalViolations += await runAxe('Panneau profil et preferences (mobile)');
}

await browser.close();
console.log(`\nTOTAL violations WCAG 2.1 A/AA detectees par axe-core: ${totalViolations}`);

// Resultats persistes pour injection automatique dans le dossier PDF.
const { mkdirSync, writeFileSync } = await import('node:fs');
mkdirSync('output/metrics', { recursive: true });
writeFileSync(
  'output/metrics/a11y.json',
  JSON.stringify(
    { generatedAt: new Date().toISOString(), screens: 3, tags: TAGS, violations: totalViolations },
    null,
    2,
  ) + '\n',
);
console.log('output/metrics/a11y.json');
process.exit(totalViolations > 0 ? 1 : 0);
