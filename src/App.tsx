import { useEffect, useState } from 'react';
import {
  deleteAccount,
  getCurrentSession,
  logoutUser,
  saveMobilityProfile } from './lib/auth';
import { clearTripHistory, loadTripHistory, saveTripRecord } from './lib/carbon';
import { bootstrapSync, startBackgroundSync } from './lib/api/sync';
import { loadTransportNetwork } from './lib/transport';
import { Card, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import type { SessionUser, TransportNetwork, TripRecord } from './types';
import { AuthScreen } from './components/auth/AuthScreen';
import { MobilityMapApp } from './components/app/MobilityMapApp';

function App() {
  const [user, setUser] = useState<SessionUser | null>(() => getCurrentSession());
  const [network, setNetwork] = useState<TransportNetwork | null>(null);
  const [networkError, setNetworkError] = useState('');
  const [tripRecords, setTripRecords] = useState<TripRecord[]>([]);
  // Tant que la sonde n'a pas repondu, on ignore si une session serveur existe :
  // afficher l'ecran de connexion tout de suite le ferait clignoter chez un
  // utilisateur deja authentifie par cookie.
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    bootstrapSync()
      .then((remoteUser) => {
        if (remoteUser) {
          setUser(remoteUser);
        }
      })
      .catch(() => undefined)
      .finally(() => setSessionChecked(true));
  }, []);

  // Rejeu en arriere-plan des operations faites hors ligne, tant qu'un
  // utilisateur est connecte.
  useEffect(() => {
    if (!user) {
      return;
    }
    return startBackgroundSync(user.id);
  }, [user]);

  useEffect(() => {
    loadTransportNetwork()
      .then(setNetwork)
      .catch((error: unknown) => {
        setNetworkError(error instanceof Error ? error.message : 'Flux transport indisponible.');
      });
  }, []);

  useEffect(() => {
    setTripRecords(user ? loadTripHistory(user.id) : []);
  }, [user]);

  if (!sessionChecked || (user && !network)) {
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

  if (!user || !network) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  return (
    <MobilityMapApp
      user={user}
      network={network}
      tripRecords={tripRecords}
      onLogout={() => {
        logoutUser();
        setUser(null);
      }}
      onProfileSave={(profile) => setUser(saveMobilityProfile(user.id, profile))}
      onTripCompleted={(record) => {
        setTripRecords(saveTripRecord(record));
      }}
      onTripHistoryClear={() => {
        clearTripHistory(user.id);
        setTripRecords([]);
      }}
      onAccountDelete={() => {
        deleteAccount(user.id);
        setUser(null);
      }}
    />
  );
}

export default App;
