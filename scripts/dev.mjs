// Demarre l'API et le serveur de developpement Vite cote a cote, avec un arret
// groupe : Ctrl+C coupe les deux, aucun processus orphelin ne garde un port.
import { spawn } from 'node:child_process';

// Les deux processus tournent sous Bun : l'API directement, le client via Vite
// force sur le runtime Bun (--bun). Un seul Ctrl+C coupe les deux.
const processes = [
  { name: 'api', command: 'bun', args: ['server/src/index.ts'] },
  { name: 'web', command: 'bunx', args: ['--bun', 'vite', '--host', '0.0.0.0'] },
];

const children = processes.map(({ name, command, args }) => {
  const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, SERVICE_NAME: name } });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      shutdown(code);
    }
  });
  return child;
});

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
  process.exitCode = code;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0));
}
