// Boucle de developpement, sous Bun uniquement.
//
// Deux processus : le serveur, qui sert l'API et le client, et une
// reconstruction du client a chaque modification. Un seul Ctrl+C coupe les deux.
//
// Pas de rechargement a chaud du client. Bun sait le faire, et Elysia
// transmet bien les routes HTML necessaires — c'est verifie. Ce qui bloque est
// que le document reference le manifeste et les icones par chemin absolu : il
// faut un greffon de resolution, et le declarer pour le serveur fait planter
// Bun 1.4.0. Detail dans bunfig.toml.
//
// La reconstruction prend moins d'une seconde ; il faut rafraichir la page.
import { spawn, type ChildProcess } from 'node:child_process';
import { watch } from 'node:fs';

const children: ChildProcess[] = [];

function run(command: string, args: string[], env: Record<string, string> = {}): ChildProcess {
  const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
  children.push(child);
  return child;
}

async function build() {
  const started = performance.now();
  const child = Bun.spawn(['bun', 'scripts/build.ts'], { env: { ...process.env, NODE_ENV: 'development' }, stdout: 'inherit', stderr: 'inherit' });
  await child.exited;
  console.log(`[web] reconstruit en ${Math.round(performance.now() - started)} ms`);
}

await build();
run('bun', ['--watch', 'server/src/index.ts'], { API_HOST: '0.0.0.0' });

// Un enregistrement declenche souvent plusieurs evenements : on attend que ca
// se calme avant de reconstruire, sinon chaque sauvegarde lance trois builds.
let pending: ReturnType<typeof setTimeout> | undefined;
for (const directory of ['src', 'index.html']) {
  watch(directory, { recursive: true }, () => {
    clearTimeout(pending);
    pending = setTimeout(() => void build(), 120);
  });
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exit(0);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, shutdown);
