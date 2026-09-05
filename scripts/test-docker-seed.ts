// Vérifie le véritable entrypoint sur des volumes jetables, sans toucher à l’application locale.
const image = Bun.env.DOCKER_TEST_IMAGE ?? 'urbanflow:seed-reference';
const container = `urbanflow-seed-test-${crypto.randomUUID()}`;

async function docker(...args: string[]) {
    const process = Bun.spawn(['docker', ...args], { stdout: 'pipe', stderr: 'pipe' });
    const [stdout, stderr, code] = await Promise.all([
        new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited,
    ]);
    if (code !== 0) throw new Error(stderr || stdout);
    return stdout;
}

async function waitForServer() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        const health = await docker('exec', container, 'bun', '-e',
            `fetch('https://localhost:4000/api/health', { tls: { rejectUnauthorized: false } }).then(r => console.log(r.status)).catch(() => console.log('waiting'))`);
        if (health.trim() === '200') return;
        await Bun.sleep(500);
    }
    throw new Error('Le serveur ne démarre pas après le peuplement.');
}

const probe = `
const base = 'https://localhost:4000/api';
async function call(path, method = 'GET', body, cookie = '') {
    const response = await fetch(base + path, { method, tls: { rejectUnauthorized: false },
        headers: { 'content-type': 'application/json', cookie }, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error(path + ' : ' + response.status);
    return response;
}
function assert(value, message) { if (!value) throw new Error(message); }
const credentials = { email: 'test@urbanflow.local', password: 'RecetteDocker2026!' };
const login = await call('/auth/login', 'POST', credentials);
const cookie = login.headers.get('set-cookie').split(';')[0];
const state = await (await call('/state', 'GET', undefined, cookie)).json();
assert(state.plannedTrips.length === 35, 'Les ponctuels ne sont pas remplis');
assert(state.recurringTrips.length === 3, 'Les récurrences ne sont pas remplies');
assert(state.tripRecords.length === 28, 'Historique carbone incomplet');
assert(state.recurringTrips.every(r => new Date(r.createdAt) < new Date()), 'Récurrences non antérieures à aujourd’hui');
const neighbor = { email: 'voisin@example.test', password: 'VoisinDocker2026!' };
if (Bun.env.PROBE_PHASE === 'first') {
    await call('/auth/register', 'POST', { ...neighbor, displayName: 'Voisin conservé' });
    await call('/trips/planned/' + state.plannedTrips[0].id, 'DELETE', undefined, cookie);
    const changed = await (await call('/state', 'GET', undefined, cookie)).json();
    assert(changed.plannedTrips.length === 34, 'La modification de recette a échoué');
} else {
    const neighborLogin = await call('/auth/login', 'POST', neighbor);
    assert((await neighborLogin.json()).user.displayName === 'Voisin conservé', 'Le compte voisin a disparu');
}
console.log('Compte rempli et connexion vérifiés : ' + Bun.env.PROBE_PHASE);
`;

try {
    await docker('run', '-d', '--name', container, '-e', 'TEST_PASSWORD=RecetteDocker2026!', image);
    await waitForServer();
    console.log((await docker('exec', '-e', 'PROBE_PHASE=first', container, 'bun', '-e', probe)).trim());
    await docker('restart', container);
    await waitForServer();
    console.log((await docker('exec', '-e', 'PROBE_PHASE=restart', container, 'bun', '-e', probe)).trim());
    console.log('Docker : peuplement avant connexion, mot de passe configurable, réinitialisation au redémarrage et compte voisin conservé.');
} finally {
    await docker('rm', '-f', '-v', container);
}
