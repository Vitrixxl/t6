// Politique reseau commune aux flux externes.
//
// En mobilite a connectivite variable, une requete qui pend est pire qu'une
// requete qui echoue vite : le repli local prend alors le relais. Le delai est
// combine au signal d'annulation eventuel de l'appelant.
const NETWORK_TIMEOUT_MS = 8000;

export function withTimeout(signal?: AbortSignal): AbortSignal {
    const timeout = AbortSignal.timeout(NETWORK_TIMEOUT_MS);
    return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
