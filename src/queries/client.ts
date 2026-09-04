// Le cache de requêtes de l'application : une instance, créée au démarrage.
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            // Le client HTTP porte déjà un délai de 8 s par requête : relancer en
            // silence masquerait une panne que l'interface doit dire.
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
}
