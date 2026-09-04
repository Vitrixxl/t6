// Service des fichiers du client.
//
// L'API sert désormais l'application elle-même : une seule origine, donc un
// cookie de session de première partie, aucun en-tête CORS, et rien à relayer.
// Le serveur de développement séparé disparaît avec.
import { Elysia } from 'elysia';
import { join, normalize } from 'node:path';

/**
 * Les fichiers empreintes ne changent jamais de contenu à nom égal : ils
 * peuvent être gardes un an. Tout le reste est revalide, faute de quoi une
 * mise en ligne ne serait pas vue par les navigateurs déjà passes.
 */
const IMMUTABLE_PREFIXES = ['/assets/', '/fonts/'];

/**
 * Resout un chemin de requête en fichier du dossier servi.
 *
 * `normalize` réduit les `..` avant la vérification : sans cette étape,
 * `/../../etc/passwd` sortirait du dossier. La comparaison porte donc sur le
 * chemin résolu, jamais sur celui reçu.
 */
function resolveWithin(root: string, requestPath: string): string | null {
    const candidate = normalize(join(root, decodeURIComponent(requestPath)));
    return candidate.startsWith(normalize(root)) ? candidate : null;
}

export function staticSite(root: string) {
    return new Elysia({ name: 'static-site' }).get('/*', async ({ path, set, status }) => {
        const resolved = resolveWithin(root, path);
        if (!resolved) {
            return status(403, 'Chemin invalide.');
        }

        const file = Bun.file(resolved);
        if (await file.exists()) {
            set.headers['cache-control'] = IMMUTABLE_PREFIXES.some((prefix) => path.startsWith(prefix))
                ? 'public, max-age=31536000, immutable'
                : 'public, max-age=0, must-revalidate';
            return file;
        }

        // Application a page unique : une adresse inconnue n'est pas une erreur,
        // c'est une route du client. Le document est renvoye et le routage se fait
        // dans le navigateur.
        const index = Bun.file(join(root, 'index.html'));
        if (await index.exists()) {
            set.headers['cache-control'] = 'public, max-age=0, must-revalidate';
            return index;
        }

        return status(404, 'Client non construit. Lancer bun run build.');
    });
}
