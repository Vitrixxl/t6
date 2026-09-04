// Ouverture de la base SQLite (module natif bun:sqlite : aucune dépendance a
// installer, aucun binaire a compiler), habillée par Drizzle.
//
// SQLite est un choix assume pour cette étape : le schéma est relationnel et
// standard, et la bascule vers PostgreSQL ne toucherait que la couche dépôt
// (repositories/) et le driver importe ici. Le schéma vit dans schema.ts ;
// les migrations SQL qui en découlent sont versionnées dans server/drizzle/.
import { Database } from 'bun:sqlite';
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as schema from './schema.ts';

const MIGRATIONS_FOLDER = join(import.meta.dir, '../../drizzle');

/** Base habillée par Drizzle ; `$client` est la connexion bun:sqlite sous-jacente (fermeture). */
export type Db = BunSQLiteDatabase<typeof schema> & { $client: Database };
/** Contexte d'une transaction ouverte : même API de requête que `Db`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Ce qu'un dépôt accepte : la base, ou une transaction en cours. */
export type Executor = Db | Tx;

export function openDatabase(databasePath: string): Db {
    if (databasePath !== ':memory:') {
        mkdirSync(dirname(databasePath), { recursive: true });
    }
    const sqlite = new Database(databasePath, { create: true });
    // Reglages de connexion, pas de schéma : ils sont poses à chaque ouverture.
    // Sans foreign_keys, les suppressions en cascade (RGPD art. 17) ne se
    // declencheraient pas.
    sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

    const db = drizzle(sqlite, { schema });
    // Applique les migrations manquantes : une nouvelle instance (poste de dev,
    // préproduction, production, base :memory: des tests) se provisionne toute
    // seule au démarrage, et une instance existante ne rejoue que ce qu'elle
    // n'a pas encore.
    migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    return db;
}

export { schema };
