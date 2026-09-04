import { useSession, useTransportNetwork } from './queries';
import { Card, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { AuthScreen } from './components/auth/AuthScreen';
import { MobilityMapApp } from './components/app/MobilityMapApp';
import { OfflineBanner } from './components/app/OfflineBanner';

function AppContent() {
    const session = useSession();
    const network = useTransportNetwork();

    // Tant que la reprise de session n'a pas répondu, on ignore si un cookie
    // valide existe : afficher l'écran de connexion tout de suite le ferait
    // clignoter chez un utilisateur déjà authentifie.
    if (session.isPending || (session.data && !network.data)) {
        return (
            <main className="grid min-h-full place-items-center bg-background p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Chargement UrbanFlow</CardTitle>
                        <CardDescription>
                            {session.isPending
                                ? 'Vérification de la session en cours.'
                                : network.error?.message || 'Synchronisation des flux GTFS et des stations partagées.'}
                        </CardDescription>
                    </CardHeader>
                </Card>
            </main>
        );
    }

    if (!session.data || !network.data) {
        return <AuthScreen />;
    }

    // La clé remet l'interface a zéro quand un autre compte se connecte.
    return <MobilityMapApp key={session.data.user.id} network={network.data} />;
}

function App() {
    return (
        <div className="flex h-full flex-col">
            <OfflineBanner />
            <div className="min-h-0 flex-1 overflow-auto">
                <AppContent />
            </div>
        </div>
    );
}

export default App;
