// Banc de performance reproductible sur le build de production (vite preview).
// Protocole : N chargements a froid (contexte navigateur neuf, cache vide),
// mesures issues des APIs Navigation Timing et Paint Timing du navigateur.
// Les resultats dependent de la machine et du reseau : le protocole (appareil,
// navigateur, reseau, date) doit etre publie avec les chiffres.
import { chromium } from 'playwright-core';

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://localhost:4000';
const CHROME_BIN = process.env.CHROME_BIN || process.env.CHROMIUM_PATH || '/usr/sbin/chromium';
const RUNS = Number(process.env.PERF_RUNS || 10);

const browser = await chromium.launch({
    executablePath: CHROME_BIN,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const samples = [];
for (let run = 1; run <= RUNS; run += 1) {
    const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        locale: 'fr-FR',
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const metrics = await page.evaluate(() => {
        const [nav] = performance.getEntriesByType('navigation');
        const paints = Object.fromEntries(performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]));
        return {
            domContentLoadedMs: nav.domContentLoadedEventEnd,
            loadMs: nav.loadEventEnd,
            firstContentfulPaintMs: paints['first-contentful-paint'] ?? null,
            transferredKb: Math.round(
                performance.getEntriesByType('resource').reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024,
            ),
        };
    });
    samples.push(metrics);
    console.log(`run ${run}/${RUNS}:`, JSON.stringify(metrics));
    await context.close();
}
await browser.close();

function stats(key) {
    const values = samples.map((sample) => sample[key]).filter((value) => value !== null).sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    const p95 = values[Math.min(Math.ceil(values.length * 0.95) - 1, values.length - 1)];
    return { median: Math.round(median), p95: Math.round(p95) };
}

console.log('\n=== Synthese (ms, cache froid, N=' + samples.length + ') ===');
for (const key of ['firstContentfulPaintMs', 'domContentLoadedMs', 'loadMs']) {
    const { median, p95 } = stats(key);
    console.log(`${key}: mediane ${median} ms | p95 ${p95} ms`);
}
console.log(`transfert initial median: ${stats('transferredKb').median} kB`);

// Resultats persistes pour injection automatique dans le dossier PDF.
const { mkdirSync, writeFileSync } = await import('node:fs');
mkdirSync('output/metrics', { recursive: true });
writeFileSync(
    'output/metrics/perf.json',
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            runs: samples.length,
            fcp: stats('firstContentfulPaintMs'),
            domContentLoaded: stats('domContentLoadedMs'),
            load: stats('loadMs'),
            transferredKbMedian: stats('transferredKb').median,
        },
        null,
        2,
    ) + '\n',
);
console.log('output/metrics/perf.json');
