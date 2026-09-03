// Construction du client, sous Bun uniquement.
//
// Le point d'entree est `src/main.tsx` plutot que `index.html` : l'analyseur
// HTML de Bun veut regrouper toutes les references absolues qu'il y trouve, y
// compris le manifeste et les icones, qui doivent au contraire garder leur
// chemin exact. Partir du TypeScript et ecrire le HTML soi-meme laisse le
// controle sur ce qui est empreinte et ce qui ne l'est pas.
import { rm, cp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import tailwind from 'bun-plugin-tailwind';
import servedAsIs from './served-as-is';

const OUT = 'dist';
const isProduction = process.env.NODE_ENV !== 'development';

await rm(OUT, { force: true, recursive: true });
await mkdir(`${OUT}/assets`, { recursive: true });

const result = await Bun.build({
  entrypoints: ['src/main.tsx'],
  outdir: `${OUT}/assets`,
  target: 'browser',
  minify: isProduction,
  // Isole ce qui n'est pas sur le chemin critique : MapLibre pese l'essentiel
  // du poids et n'est charge qu'apres l'ecran de connexion.
  splitting: true,
  // Pas de carte de source publiee : plusieurs megaoctets en moins, et le code
  // source n'est pas expose.
  sourcemap: 'none',
  plugins: [servedAsIs, tailwind],
  // Les blocs reserves au developpement disparaissent du paquet : la garde est
  // evaluee a la compilation, pas a l'execution.
  define: { 'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development') },
  naming: { entry: '[name]-[hash].[ext]', chunk: '[name]-[hash].[ext]', asset: '[name]-[hash].[ext]' },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const href = (artifact: { path: string }) => `/assets/${artifact.path.split('/').pop()}`;

// Le point d'entree est designe par son `kind`, pas par son nom : plusieurs
// artefacts commencent par `main-` une fois le decoupage applique, et choisir
// par prefixe reviendrait a tirer au sort entre le paquet principal et un
// fragment de vingt kilo-octets.
const entry = result.outputs.find((artifact) => artifact.kind === 'entry-point' && artifact.path.endsWith('.js'));
if (!entry) {
  console.error('Aucun point d entree JavaScript produit.');
  process.exit(1);
}
const script = href(entry);
const styles = result.outputs.filter((artifact) => artifact.path.endsWith('.css')).map(href);

// Le HTML est produit a partir du gabarit : les noms empreintes ne peuvent pas
// y etre ecrits a la main sans se desynchroniser au prochain build.
const template = await readFile('index.html', 'utf8');
const html = template
  .replace('<script type="module" src="/src/main.tsx"></script>', `<script type="module" src="${script}"></script>`)
  .replace('</head>', `${styles.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}\n  </head>`);
await writeFile(`${OUT}/index.html`, html);

// Les polices sont copiees a cote plutot qu'encodees dans la feuille de style :
// encodees, elles ajoutaient une centaine de kilo-octets a un CSS qui bloque le
// rendu. Servies a part, elles se chargent en parallele et se mettent en cache
// independamment du reste.
await mkdir(`${OUT}/fonts`, { recursive: true });
for (const [pkg, subsets] of Object.entries({
  figtree: ['latin', 'latin-ext'],
  'bricolage-grotesque': ['latin', 'latin-ext', 'vietnamese'],
})) {
  for (const subset of subsets) {
    const file = `${pkg}-${subset}-wght-normal.woff2`;
    await cp(`node_modules/@fontsource-variable/${pkg}/files/${file}`, `${OUT}/fonts/${file}`);
  }
}

// `public/` est copie tel quel : manifeste, service worker, icones et donnees
// de repli sont servis a leur chemin exact, sans empreinte — le service worker
// et le manifeste ne toleraient pas d'etre renommes.
if (existsSync('public')) {
  await cp('public', OUT, { recursive: true });
}

const total = result.outputs.reduce((sum, artifact) => sum + artifact.size, 0);
console.log(`Client construit : ${result.outputs.length} fichiers, ${(total / 1024).toFixed(0)} kB`);
for (const artifact of result.outputs.filter((a) => a.size > 100_000).sort((a, b) => b.size - a.size)) {
  console.log(`  ${artifact.path.split('/').pop()} — ${(artifact.size / 1024).toFixed(0)} kB`);
}
