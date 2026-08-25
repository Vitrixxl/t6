// Contexte applicatif : ouvre la base et expose la configuration et les depots
// a toutes les routes.
//
// Forme conventionnelle d'un plugin Elysia : un `name` (le framework
// deduplique le plugin s'il est monte plusieurs fois) et des valeurs exposees
// via `.decorate()`, dont le type est propage aux gestionnaires.
import { Elysia } from 'elysia';
import type { ServerConfig } from '../config/index.ts';
import { openDatabase } from '../db/index.ts';
import { createRepositories } from '../repositories/index.ts';

/**
 * A n'appeler qu'une fois par application : cette fabrique ouvre la connexion
 * SQLite. Les autres plugins recoivent l'instance construite en argument.
 */
export function context(config: ServerConfig) {
  const db = openDatabase(config.databasePath);
  const repositories = createRepositories(db);

  return new Elysia({ name: 'context' })
    .decorate('config', config)
    .decorate('db', db)
    .decorate('repositories', repositories)
    .onStop(() => {
      db.close();
    })
    .as('global');
}

export type AppContext = ReturnType<typeof context>;
