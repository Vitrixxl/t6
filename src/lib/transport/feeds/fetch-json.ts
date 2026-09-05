// Lecture JSON commune aux flux : délai borné et erreur explicite, pour que
// chaque appelant puisse traiter l’indisponibilité sans inspecter la réponse.
const FETCH_TIMEOUT_MS = 8000;

export async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/json',
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
        throw new Error(`Flux indisponible: ${url} (${response.status})`);
    }

    return response.json() as Promise<T>;
}
