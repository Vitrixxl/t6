// Le cache de requetes de l'application : une instance, creee au demarrage.
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Le client HTTP porte deja un delai de 8 s par requete : relancer en
      // silence masquerait une panne que l'interface doit dire.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}
