// Crée (ou reinitialise) le compte de démonstration utilise pour la
// présentation. Volontairement un script a lancer à la main : rien ne crée de
// compte a mot de passe connu au démarrage du serveur.
import { loadConfig } from './config/index.ts';
import { openDatabase } from './db/index.ts';
import { DEFAULT_PROFILE, TERMS_VERSION } from '../../src/contracts/index.ts';
import { createRepositories } from './repositories/index.ts';
import { hashPassword } from './security/password.ts';
import type { MobilityProfile } from '../../src/types.ts';

const DEMO_EMAIL = 'demo@urbanflow.local';
const DEMO_PASSWORD = Bun.env.DEMO_PASSWORD ?? 'UrbanFlow2026!';

const config = loadConfig();
if (config.isProduction && !Bun.env.DEMO_PASSWORD) {
    console.error('En production, définir DEMO_PASSWORD plutôt que le mot de passe par défaut.');
    process.exit(1);
}

const db = openDatabase(config.databasePath);
const { users } = createRepositories(db);

const now = new Date().toISOString();
// Le compte de démonstration a déjà répondu aux questions d'accueil : la recette part de la carte.
const profile: MobilityProfile = { ...DEFAULT_PROFILE, displayName: 'Démo UrbanFlow', onboardedAt: now };

// Reinitialisation plutôt que mise à jour : la démonstration repart toujours
// d'un compte propre, sans trajet hérité d'une session précédente.
const existing = users.findByEmail(DEMO_EMAIL);
if (existing) {
    users.delete(existing.id);
}

users.insert({
    id: crypto.randomUUID(),
    email: DEMO_EMAIL,
    displayName: profile.displayName,
    passwordHash: await hashPassword(DEMO_PASSWORD),
    createdAt: now,
    termsAcceptedAt: now,
    termsVersion: TERMS_VERSION,
    profile,
});

db.$client.close();
console.log(`Compte de démonstration prêt : ${DEMO_EMAIL}`);
