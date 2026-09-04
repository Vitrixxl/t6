import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
    };
}

function readOnlineStatus(): boolean {
    return navigator.onLine;
}

export function useOnlineStatus(): boolean {
    // Le signal du navigateur décrit la connexion, pas la disponibilité de
    // l'API : une erreur serveur ne doit pas annoncer une coupure Internet.
    return useSyncExternalStore(subscribe, readOnlineStatus);
}
