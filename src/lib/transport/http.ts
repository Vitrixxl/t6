// Politique réseau commune aux flux externes.
//
// En mobilité a connectivite variable, une requête qui pend est pire qu'une
// requête qui echoue vite : le repli local prend alors le relais. Le délai est
// combine au signal d'annulation eventuel de l'appelant.
const NETWORK_TIMEOUT_MS = 8000;

export function withTimeout(signal?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(NETWORK_TIMEOUT_MS);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
