// Mesure les artefacts du build de production (dist/) et ecrit le resultat en
// JSON. Le generateur du dossier PDF lit ce fichier : les chiffres publies sont
// donc extraits du build reellement livre, jamais recopies a la main.
// Convention identique a Vite : tailles en kB decimaux (1 kB = 1000 octets).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const ASSETS_DIR = 'dist/assets';
const OUTPUT = 'output/metrics/build.json';

const assets = readdirSync(ASSETS_DIR);
const pick = (pattern) => assets.find((name) => pattern.test(name));
const entry = pick(/^index-.*\.js$/);
const maplibre = pick(/^maplibre-.*\.js$/);
const css = pick(/^index-.*\.css$/);
if (!entry || !maplibre || !css) {
  console.error('Artefacts introuvables dans dist/assets : lancer `npm run build` d\'abord.');
  process.exit(1);
}

const kb = (bytes) => Math.round((bytes / 1000) * 100) / 100;
const measure = (name) => {
  const content = readFileSync(`${ASSETS_DIR}/${name}`);
  return { file: name, rawKb: kb(content.length), gzipKb: kb(gzipSync(content).length) };
};

const metrics = {
  generatedAt: new Date().toISOString(),
  builtAt: statSync(`${ASSETS_DIR}/${entry}`).mtime.toISOString(),
  entry: measure(entry),
  maplibre: measure(maplibre),
  css: measure(css),
};

mkdirSync('output/metrics', { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(metrics, null, 2) + '\n');
console.log(OUTPUT);
console.log(`entree ${metrics.entry.gzipKb} kB gzip | maplibre ${metrics.maplibre.gzipKb} kB gzip | css ${metrics.css.gzipKb} kB gzip`);
