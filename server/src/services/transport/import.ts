// L'archive normalisée est un artefact d'import serveur, jamais une ressource
// publique. Son empreinte évite de réécrire SQLite à chaque redémarrage.
import { readFileSync } from 'node:fs';
import { gtfsFeed } from '../../../../src/contracts/transport.ts';
import type { Db } from '../../db/index.ts';
import { createTransportRepository } from '../../repositories/transport.ts';

const source = readFileSync(new URL('../../../../data/transport/gtfs-feed.json', import.meta.url), 'utf8');
const version = new Bun.CryptoHasher('sha256').update(source).digest('hex');
const feed = gtfsFeed.parse(JSON.parse(source));

export function importTransportNetwork(db: Db) {
    const repository = createTransportRepository(db);
    if (repository.hasVersion(version)) return;
    db.transaction(tx => createTransportRepository(tx).importNetwork(feed, version));
}
