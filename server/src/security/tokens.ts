// Jetons de session.
//
// Un jeton opaque tire au sort, dont seule l'empreinte est persistee. Deux
// consequences : le serveur peut le revoquer a tout moment (contrairement a un
// JWT autoporteur), et une fuite de la base ne permet pas de rejouer une
// session.
import { createHash, randomBytes } from 'node:crypto';

/** Jeton de session opaque (256 bits d'entropie), transmis au client une seule fois. */
export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Seule l'empreinte du jeton est persistee, jamais le jeton lui-meme. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
