// Même recette avant push et sur GitHub : base vide et moteurs dédiés,
// sans dépendre des conteneurs ni de la base SQLite du poste de développement.
import { $ } from 'bun';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const image = 'ghcr.io/project-osrm/osrm-backend@sha256:8a1b1bc938412f15f9b5b32d794c4ec6bf4a85dfbbabfa0a014b70b187edb53b';
const logDir = resolve('tmp/ci');
await mkdir(logDir, { recursive: true });
await mkdir('tmp/screenshots', { recursive: true });
await Bun.write(resolve(logDir, 'server.log'), '');
await Bun.write(resolve(logDir, 'server-errors.log'), '');
const directory = await mkdtemp(resolve(logDir, 'run-'));
const prefix = `urbanflow-ci-${process.pid}`;
const containers: string[] = [];
const port = process.env.CI_API_PORT || '4101';
// Playwright transmet les cookies Secure sur localhost, comme Chromium.
const base = `http://localhost:${port}`;
const env = {
    ...process.env,
    DATABASE_PATH: resolve(directory, 'account.db'),
    API_HOST: '127.0.0.1', API_PORT: port,
    TLS_CERT_PATH: '', TLS_KEY_PATH: '',
    E2E_BASE_URL: base, AUDIT_BASE_URL: base,
};
let server: ReturnType<typeof Bun.spawn> | undefined;

async function run(command: string[], environment = env) {
    console.log(`\n→ ${command.join(' ')}`);
    const process = Bun.spawn(command, { env: environment, stdout: 'inherit', stderr: 'inherit' });
    const code = await process.exited;
    if (code !== 0) throw new Error(`${command.join(' ')} : code ${code}`);
}

async function waitForHttp(url: string) {
    for (let attempt = 0; attempt < 30; attempt++) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
            if (response.ok) return;
        } catch {
            // Le processus vient d’être lancé ; il dispose au plus de 30 essais.
        }
        await Bun.sleep(1000);
    }
    throw new Error(`Service indisponible : ${url}`);
}

async function startRouting(mode: 'foot' | 'bike' | 'car') {
    const name = `${prefix}-${mode}`;
    const profile = mode === 'bike' ? 'bicycle' : mode;
    await copyFile('scripts/fixtures/lyon-roads.osm.pbf', resolve(directory, `${mode}.osm.pbf`));
    for (const command of [
        ['osrm-extract', '-p', `/opt/${profile}.lua`, `/data/${mode}.osm.pbf`],
        ['osrm-partition', `/data/${mode}.osrm`],
        ['osrm-customize', `/data/${mode}.osrm`],
    ]) {
        await run(['docker', 'run', '--rm', '-v', `${directory}:/data`, image, ...command]);
    }
    containers.push(name);
    await run(['docker', 'run', '-d', '--name', name, '-v', `${directory}:/data:ro`,
        '-p', '127.0.0.1::5000', image, 'osrm-routed', '--algorithm', 'mld', `/data/${mode}.osrm`]);
    const address = (await $`docker port ${name} 5000/tcp`.text()).trim();
    const url = `http://${address}`;
    await waitForHttp(`${url}/route/v1/driving/4.832,45.7578;4.85,45.76?overview=false`);
    return url;
}

try {
    // Un port occupé doit arrêter la recette, jamais faire tester un autre serveur.
    const probe = Bun.listen({ hostname: '127.0.0.1', port: Number(port), socket: { data() {} } });
    probe.stop(true);
    await run(['bun', 'install', '--frozen-lockfile']);
    await run(['bun', 'run', 'check']);
    await run(['bun', 'run', 'metrics:build']);
    await run(['docker', 'pull', image]);
    const routingEnv = {
        ...env,
        OSRM_FOOT_URL: await startRouting('foot'),
        OSRM_BIKE_URL: await startRouting('bike'),
        OSRM_CAR_URL: await startRouting('car'),
    };
    await run(['bun', 'run', 'seed:demo'], routingEnv);
    server = Bun.spawn(['bun', 'server/src/index.ts'], {
        env: { ...routingEnv, NODE_ENV: 'production' }, stdout: Bun.file(resolve(logDir, 'server.log')), stderr: Bun.file(resolve(logDir, 'server-errors.log')),
    });
    await waitForHttp(`${base}/api/health`);
    await run(['bun', 'run', 'audit:a11y']);
    await run(['bun', 'run', 'e2e']);
    await run(['bun', 'run', 'e2e:transport']);
    await run(['bun', 'scripts/e2e-mobile-transit.mjs']);
    await run(['bun', 'scripts/e2e-api-doc.mjs']);
    // La performance reste indicative, comme dans le workflow précédent.
    try {
        await run(['bun', 'run', 'bench:perf']);
    } catch (error) {
        console.warn('Banc de performance non bloquant :', error);
    }
    console.log('\nCI complète réussie.');
} finally {
    server?.kill();
    if (server) await server.exited;
    for (const name of containers) {
        await $`docker logs ${name}`.quiet().then(result => Bun.write(resolve(logDir, `${name}.log`), result.stdout)).catch(() => {});
        await $`docker rm -f ${name}`.quiet().catch(() => {});
    }
    await rm(directory, { recursive: true, force: true });
}
