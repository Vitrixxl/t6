// Configuration de drizzle-kit : génération des migrations SQL à partir du
// schéma TypeScript. La base n'est lue que par `db:studio` ; `db:generate` ne
// fait que comparer le schéma aux migrations déjà émises.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'sqlite',
    schema: './server/src/db/schema.ts',
    out: './server/drizzle',
    dbCredentials: { url: process.env.DATABASE_PATH ?? 'server/data/urbanflow.db' },
});
