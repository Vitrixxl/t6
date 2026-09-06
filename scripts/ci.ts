// Même recette avant push et sur GitHub : base vide et moteur dédié,
// sans dépendre des conteneurs ni de la base SQLite du poste de développement.
import { $ } from 'bun';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const image = 'ghcr.io/motis-project/motis@sha256:6055f51eec43eeed28524037ca0161b96efe9cd05728eaa9ac04c20c2826d330';
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

/** Chaque scénario repart avec sa propre fenêtre de débit, comme une nouvelle session de recette. */
async function runBrowser(command: string[], environment: typeof env & { MOTIS_URL: string }) {
    const name = command.at(-1)?.replaceAll(/[^a-zA-Z0-9-]/g, '-') ?? 'browser';
    server = Bun.spawn(['bun', 'server/src/index.ts'], {
        env: { ...environment, NODE_ENV: 'production' },
        stdout: Bun.file(resolve(logDir, `${name}-server.log`)),
        stderr: Bun.file(resolve(logDir, `${name}-server-errors.log`)),
    });
    try {
        await waitForHttp(`${base}/api/health`);
        await run(command);
    } finally {
        server.kill();
        await server.exited;
        server = undefined;
    }
}

async function waitForHttp(url: string) {
    for (let attempt = 0; attempt < 60; attempt++) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
            if (response.ok) return;
        } catch {
            // Le processus vient d’être lancé ; il dispose au plus de 60 essais.
        }
        await Bun.sleep(1000);
    }
    throw new Error(`Service indisponible : ${url}`);
}

/**
 * Un MOTIS jetable sur les fixtures versionnées : l'extrait routier réel de
 * Lyon et l'horaire GTFS de recette dérivé du réseau livré. Les flux GBFS
 * restent les vrais.
 */
async function startMotis(withTransit: boolean) {
    const name = `${prefix}-motis-${withTransit ? "transit" : "streets"}`;
    const motorDirectory = resolve(directory, withTransit ? "transit" : "streets");
    await mkdir(motorDirectory);
    await copyFile('scripts/fixtures/lyon-roads.osm.pbf', resolve(motorDirectory, 'lyon-roads.osm.pbf'));
    if (withTransit) await copyFile('scripts/fixtures/lyon-ci.gtfs.zip', resolve(motorDirectory, 'lyon-ci.gtfs.zip'));
    await Bun.write(resolve(motorDirectory, 'config.yml'), [
        'server:', '  port: 8080',
        'osm: lyon-roads.osm.pbf',
        ...(withTransit ? ['timetable:', '  first_day: TODAY', '  num_days: 2',
            '  datasets:', '    tcl:', '      path: lyon-ci.gtfs.zip', 'osr_footpath: true'] : []),
        'street_routing: true', 'geocoding: false', 'reverse_geocoding: false',
        'gbfs:', '  feeds:',
        '    velov:', '      url: https://api.cyclocity.fr/contracts/lyon/gbfs/v3/gbfs.json',
        '    dott:', '      url: https://gbfs.api.ridedott.com/public/v2/lyon/gbfs.json',
        '',
    ].join('\n'));
    await mkdir(resolve(motorDirectory, 'data'), { recursive: true });
    // Le conteneur tourne sous l'utilisateur courant : il lit le dossier temporaire
    // (né en 0700) et le graphe qu'il écrit reste supprimable à la fin.
    const user = `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`;
    await run(['docker', 'run', '--rm', '-u', user, '-v', `${motorDirectory}:/data`, '-w', '/data', image,
        '/motis', 'import', '-c', '/data/config.yml', '-d', '/data/data']);
    containers.push(name);
    await run(['docker', 'run', '-d', '--name', name, '-u', user, '-v', `${motorDirectory}:/data`, '-w', '/data',
        '-p', '127.0.0.1::8080', image, '/motis', 'server', '-d', '/data/data']);
    const address = (await $`docker port ${name} 8080/tcp`.text()).trim();
    const url = `http://${address}`;
    await waitForHttp(`${url}/api/v1/one-to-many?one=45.7578;4.832&many=45.76;4.85&mode=WALK&max=3600&maxMatchingDistance=250&arriveBy=false`);
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
    const routingEnv = { ...env, MOTIS_TRANSIT_ENABLED: 'true', MOTIS_URL: await startMotis(true) };
    await run(['bun', 'run', 'seed:demo'], routingEnv);
    await runBrowser(['bun', 'run', 'audit:a11y'], routingEnv);
    await runBrowser(['bun', 'scripts/e2e-onboarding.mjs'], routingEnv);
    await runBrowser(['bun', 'run', 'e2e'], routingEnv);
    await runBrowser(['bun', 'run', 'e2e:transport'], routingEnv);
    await runBrowser(['bun', 'scripts/e2e-mobile-transit.mjs'], routingEnv);
    await runBrowser(['bun', 'scripts/e2e-api-doc.mjs'], routingEnv);
    await runBrowser(['bun', 'run', 'e2e:offline'], routingEnv);
    await runBrowser(['bun', 'run', 'e2e:trips'], routingEnv);
    await runBrowser(['bun', 'scripts/e2e-account-export.mjs'], routingEnv);
    // La performance reste indicative, comme dans le workflow précédent.
    try {
        await runBrowser(['bun', 'run', 'bench:perf'], routingEnv);
    } catch (error) {
        console.warn('Banc de performance non bloquant :', error);
    }
    const streetsEnv = { ...env, MOTIS_TRANSIT_ENABLED: 'false', MOTIS_URL: await startMotis(false) };
    await runBrowser(['bun', 'scripts/e2e-no-timetable.mjs'], streetsEnv);
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
