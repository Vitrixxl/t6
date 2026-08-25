// Ouverture de la base SQLite (module natif bun:sqlite : aucune dependance a
// installer, aucun binaire a compiler).
//
// SQLite est un choix assume pour cette etape : le schema est relationnel et
// standard, et la bascule vers PostgreSQL ne toucherait que la couche depot
// (repositories/). Le schema vit dans schema.sql plutot que dans une chaine
// TypeScript : il reste lisible, colorise, et comparable par un DBA.
import { Database } from 'bun:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type { Database };

// Applique de facon idempotente : une nouvelle instance (poste de dev,
// preproduction, production) se provisionne toute seule au demarrage.
const SCHEMA = readFileSync(join(import.meta.dir, 'schema.sql'), 'utf8');

export function openDatabase(databasePath: string): Database {
  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
  const db = new Database(databasePath, { create: true });
  db.exec(SCHEMA);
  return db;
}
