// Configuration de drizzle-kit : generation des migrations SQL a partir du
// schema TypeScript. La base n'est lue que par `db:studio` ; `db:generate` ne
// fait que comparer le schema aux migrations deja emises.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    dialect: 'sqlite',
    schema: './server/src/db/schema.ts',
    out: './server/drizzle',
    dbCredentials: { url: process.env.DATABASE_PATH ?? 'server/data/urbanflow.db' },
});
