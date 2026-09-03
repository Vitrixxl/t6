// Hachage et verification des mots de passe.
// Aucune cryptographie artisanale : argon2id est fourni par le moteur Bun.

// argon2id est la premiere recommandation de l'OWASP Password Storage Cheat
// Sheet : fonction memory-hard, donc resistante au calcul massivement
// parallele sur GPU, contrairement a PBKDF2.
// Parametres OWASP : 19 Mio de memoire, 2 iterations, parallelisme 1.
const ARGON2_OPTIONS = {
  algorithm: 'argon2id',
  memoryCost: 19_456,
  timeCost: 2,
} as const;

export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password.normalize('NFKC'), ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    // Bun.password.verify lit les parametres dans l'empreinte elle-meme et
    // compare a temps constant.
    return await Bun.password.verify(password.normalize('NFKC'), stored);
  } catch {
    // Empreinte illisible (donnee corrompue) : on refuse, on ne laisse pas
    // remonter une exception sur le chemin de connexion.
    return false;
  }
}
