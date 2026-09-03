import { useEffect, useState } from 'react';
import { logoutUser } from './lib/auth';
import { restoreSession, type Session } from './lib/api/account';
import { loadTransportNetwork } from './lib/transport';
import { Card, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import type { TransportNetwork } from './types';
import { AuthScreen } from './components/auth/AuthScreen';
import { MobilityMapApp } from './components/app/MobilityMapApp';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [network, setNetwork] = useState<TransportNetwork | null>(null);
  const [networkError, setNetworkError] = useState('');
  // Tant que la reprise de session n'a pas repondu, on ignore si un cookie
  // valide existe : afficher l'ecran de connexion tout de suite le ferait
  // clignoter chez un utilisateur deja authentifie.
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    restoreSession()
      .then(setSession)
      .catch(() => undefined)
      .finally(() => setSessionChecked(true));
  }, []);

  useEffect(() => {
    loadTransportNetwork()
      .then(setNetwork)
      .catch((error: unknown) => {
        setNetworkError(error instanceof Error ? error.message : 'Flux transport indisponible.');
      });
  }, []);

  if (!sessionChecked || (session && !network)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Chargement UrbanFlow</CardTitle>
            <CardDescription>
              {sessionChecked
                ? networkError || 'Synchronisation des flux GTFS et des stations partagees.'
                : 'Verification de la session en cours.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!session || !network) {
    return <AuthScreen onAuthenticated={setSession} />;
  }

  // La cle force un nouvel etat en memoire quand un autre compte se connecte.
  return (
    <MobilityMapApp
      key={session.user.id}
      session={session}
      network={network}
      onLogout={() => {
        logoutUser();
        setSession(null);
      }}
      onAccountDeleted={() => setSession(null)}
    />
  );
}

export default App;
