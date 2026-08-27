// Lecture JSON commune aux flux : delai borne et erreur explicite, pour que
// chaque appelant puisse decider de son repli local sans inspecter la reponse.
const FETCH_TIMEOUT_MS = 8000;

export async function fetchJson<T>(url: string, fetcher: typeof fetch = fetch): Promise<T> {
  const response = await fetcher(url, {
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
