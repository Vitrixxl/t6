// Mesure les artefacts du build de production (dist/) et ecrit le résultat en
// JSON. Le générateur du dossier PDF lit ce fichier : les chiffres publies sont
// donc extraits du build réellement livre, jamais recopies à la main.
// Convention identique a Vite : tailles en kB decimaux (1 kB = 1000 octets).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const ASSETS_DIR = 'dist/assets';
const OUTPUT = 'output/metrics/build.json';

// Les artefacts sont identifiés par leur rôle et non par leur nom : celui-ci
// dépend du bundler et du point d'entrée, et un motif code en dur casse
// silencieusement dès que l'un des deux change.
const assets = readdirSync(ASSETS_DIR);
const document = readFileSync('dist/index.html', 'utf8');
const referenced = (extension) => {
    const match = document.match(new RegExp(`/assets/([\\w.-]+\\${extension})`));
    return match?.[1];
};

// Le point d'entrée et la feuille de style sont ceux que le document charge.
const entry = referenced('.js');
const css = referenced('.css');
// Le fragment differe est le plus gros des autres : c'est celui dont le poids
// merite d'être suivi, quel que soit le module qui l'a fait naître.
const maplibre = assets
    .filter((name) => name.endsWith('.js') && name !== entry)
    .sort((a, b) => statSync(`${ASSETS_DIR}/${b}`).size - statSync(`${ASSETS_DIR}/${a}`).size)[0];
if (!entry || !maplibre || !css) {
    console.error('Artefacts introuvables dans dist/assets : lancer `bun run build` d\'abord.');
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
console.log(`entrée ${metrics.entry.gzipKb} kB gzip | maplibre ${metrics.maplibre.gzipKb} kB gzip | css ${metrics.css.gzipKb} kB gzip`);
