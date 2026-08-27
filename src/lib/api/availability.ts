// Disponibilite du serveur.
//
// L'application doit rester utilisable sans API (exigence C10, connectivite
// variable, et mode de demonstration autonome). On ne suppose donc jamais que
// le serveur repond : sa disponibilite est sondee une fois au demarrage, et
// tout appel qui echoue au niveau reseau bascule l'application en mode local.
import { API_BASE, PROBE_TIMEOUT_MS } from './config';

// null = pas encore sonde. Tant que la sonde n'a pas repondu, aucun appel
// reseau n'est tente : les tests unitaires et le mode autonome restent
// purement locaux, sans requete parasite.
let availability: boolean | null = null;

export function isApiOnline(): boolean {
  return availability === true;
}

export function markApiOffline(): void {
  availability = false;
}

/**
 * Sonde unique au demarrage : decide si l'application tourne en mode serveur.
 *
 * On verifie la charge utile et pas seulement le code HTTP : servie en
 * statique sans API, la route /api/health renvoie l'index HTML de
 * l'application avec un code 200, ce qui ferait passer un deploiement sans
 * serveur pour un serveur.
 */
export async function probeApi(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const payload: unknown = response.ok ? await response.json().catch(() => null) : null;
    availability =
      typeof payload === 'object' && payload !== null && (payload as { status?: unknown }).status === 'ok';
  } catch {
    availability = false;
  }
  return availability;
}
