import { useSession, useTransportNetwork } from './queries';
import { Card, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { AuthScreen } from './components/auth/AuthScreen';
import { MobilityMapApp } from './components/app/MobilityMapApp';

function App() {
  const session = useSession();
  const network = useTransportNetwork();

  // Tant que la reprise de session n'a pas repondu, on ignore si un cookie
  // valide existe : afficher l'ecran de connexion tout de suite le ferait
  // clignoter chez un utilisateur deja authentifie.
  if (session.isPending || (session.data && !network.data)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Chargement UrbanFlow</CardTitle>
            <CardDescription>
              {session.isPending
                ? 'Verification de la session en cours.'
                : network.error?.message || 'Synchronisation des flux GTFS et des stations partagees.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!session.data || !network.data) {
    return <AuthScreen />;
  }

  // La cle remet l'interface a zero quand un autre compte se connecte.
  return <MobilityMapApp key={session.data.user.id} network={network.data} />;
}

export default App;
