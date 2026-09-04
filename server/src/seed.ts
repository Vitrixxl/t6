// Cree (ou reinitialise) le compte de demonstration utilise pour la
// presentation. Volontairement un script a lancer a la main : rien ne cree de
// compte a mot de passe connu au demarrage du serveur.
import { loadConfig } from './config/index.ts';
import { openDatabase } from './db/index.ts';
import { DEFAULT_PROFILE } from '../../src/contracts/index.ts';
import { createRepositories } from './repositories/index.ts';
import { hashPassword } from './security/password.ts';
import type { MobilityProfile } from '../../src/types.ts';

const DEMO_EMAIL = 'demo@urbanflow.local';
const DEMO_PASSWORD = Bun.env.DEMO_PASSWORD ?? 'UrbanFlow2026!';

const config = loadConfig();
if (config.isProduction && !Bun.env.DEMO_PASSWORD) {
  console.error('En production, definir DEMO_PASSWORD plutot que le mot de passe par defaut.');
  process.exit(1);
}

const db = openDatabase(config.databasePath);
const { users } = createRepositories(db);

const profile: MobilityProfile = { ...DEFAULT_PROFILE, displayName: 'Demo UrbanFlow' };

// Reinitialisation plutot que mise a jour : la demonstration repart toujours
// d'un compte propre, sans trajet herite d'une session precedente.
const existing = users.findByEmail(DEMO_EMAIL);
if (existing) {
  users.delete(existing.id);
}

users.insert({
  id: crypto.randomUUID(),
  email: DEMO_EMAIL,
  displayName: profile.displayName,
  passwordHash: await hashPassword(DEMO_PASSWORD),
  createdAt: new Date().toISOString(),
  profile,
});

db.$client.close();
console.log(`Compte de demonstration pret : ${DEMO_EMAIL}`);
