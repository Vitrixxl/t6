import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  DEMO_CREDENTIALS,
  deleteLocalAccount,
  getCurrentSession,
  loginUser,
  logoutUser,
  registerUser,
  saveMobilityProfile,
} from './lib/auth';
import { clearTripHistory, createTripRecord, loadTripHistory, saveTripRecord, summarizeCarbon } from './lib/carbon';
import { enhanceRoutesWithLiveRouting, searchPlaces, type PlaceSearchResult } from './lib/externalApis';
import { createSavedRouteRecord, deleteSavedRouteRecord, loadSavedRoutes, saveSavedRouteRecord } from './lib/savedRoutes';
import { getFeedFreshness, loadTransportNetwork } from './lib/transportApi';
import { LANDMARKS, haversineDistanceKm, planRoutes } from './lib/routePlanner';
import { getRouteColor, UrbanMap } from './components/UrbanMap';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './components/ui/dialog';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from './components/ui/drawer';
import { Input } from './components/ui/input';
import type { GeoPoint, MobilityMode, MobilityProfile, RouteInstruction, RouteOption, SavedRouteRecord, SessionUser, TransportNetwork, TripRecord } from './types';
import {
  Bike,
  Bus,
  Car,
  Check,
  Footprints,
  Layers3,
  LocateFixed,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Navigation,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Zap,
} from 'lucide-react';

const MODE_OPTIONS: Array<{ mode: MobilityMode; label: string }> = [
  { mode: 'walk', label: 'Marche' },
  { mode: 'bike', label: 'Velo' },
  { mode: 'scooter', label: 'Trottinette' },
  { mode: 'transit', label: 'Transport public' },
  { mode: 'carpool', label: 'Covoiturage' },
];

const ALL_MOBILITY_MODES = MODE_OPTIONS.map((option) => option.mode);

const MODE_ICON: Record<MobilityMode, typeof Footprints> = {
  walk: Footprints,
  bike: Bike,
  scooter: Zap,
  transit: Bus,
  carpool: Car,
};

type LayerState = {
  transitStops: boolean;
  sharedMobility: boolean;
  incidents: boolean;
};

type MobileSheetLevel = 'collapsed' | 'mid' | 'expanded';

type SearchHistoryEntry = {
  id: string;
  origin: GeoPoint;
  destination: GeoPoint;
  createdAt: string;
};

const NAVIGATION_START_RADIUS_METERS = 120;
const SEARCH_HISTORY_LIMIT = 8;

const DEFAULT_LAYERS: LayerState = {
  transitStops: true,
  sharedMobility: true,
  incidents: true,
};

const MOBILE_SHEET_ORDER: MobileSheetLevel[] = ['collapsed', 'mid', 'expanded'];
const MOBILE_SHEET_HEIGHT: Record<MobileSheetLevel, { shell: string; content: string }> = {
  collapsed: {
    shell: 'max-h-[30dvh]',
    content: 'max-h-[calc(30dvh-0.5rem)]',
  },
  mid: {
    shell: 'max-h-[54dvh]',
    content: 'max-h-[calc(54dvh-0.5rem)]',
  },
  expanded: {
    shell: 'max-h-[82dvh]',
    content: 'max-h-[calc(82dvh-0.5rem)]',
  },
};

function shiftMobileSheetLevel(current: MobileSheetLevel, direction: -1 | 1) {
  const currentIndex = MOBILE_SHEET_ORDER.indexOf(current);
  const nextIndex = Math.min(Math.max(currentIndex + direction, 0), MOBILE_SHEET_ORDER.length - 1);
  return MOBILE_SHEET_ORDER[nextIndex];
}

function searchHistoryStorageKey(userId: string) {
  return `urbanflow:search-history:${userId}`;
}

function loadSearchHistory(userId: string): SearchHistoryEntry[] {
  try {
    const rawValue = window.localStorage.getItem(searchHistoryStorageKey(userId));
    if (!rawValue) {
      return [];
    }
    const parsed = JSON.parse(rawValue) as SearchHistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, SEARCH_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(userId: string, entries: SearchHistoryEntry[]) {
  window.localStorage.setItem(searchHistoryStorageKey(userId), JSON.stringify(entries.slice(0, SEARCH_HISTORY_LIMIT)));
}

function upsertSearchHistory(entries: SearchHistoryEntry[], origin: GeoPoint, destination: GeoPoint): SearchHistoryEntry[] {
  const id = `${origin.label}-${origin.lat.toFixed(5)}-${origin.lon.toFixed(5)}-${destination.label}-${destination.lat.toFixed(5)}-${destination.lon.toFixed(5)}`;
  const nextEntry: SearchHistoryEntry = {
    id,
    origin,
    destination,
    createdAt: new Date().toISOString(),
  };
  return [nextEntry, ...entries.filter((entry) => entry.id !== id)].slice(0, SEARCH_HISTORY_LIMIT);
}

function navigationInstruction(routeOption: RouteOption, progress: number): RouteInstruction | null {
  if (routeOption.instructions.length === 0) {
    return null;
  }
  const instructionIndex = Math.min(Math.floor(progress * routeOption.instructions.length), routeOption.instructions.length - 1);
  return routeOption.instructions[instructionIndex];
}

function routeProgressForPoint(path: GeoPoint[], point: GeoPoint): number {
  if (path.length < 2) {
    return 0;
  }

  let traversedKm = 0;
  let totalKm = 0;
  let bestDistanceSq = Number.POSITIVE_INFINITY;
  let bestAlongKm = 0;

  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const segmentKm = haversineDistanceKm(start, end);
    totalKm += segmentKm;

    const averageLat = ((start.lat + end.lat + point.lat) / 3) * (Math.PI / 180);
    const scale = Math.cos(averageLat);
    const startX = start.lon * scale;
    const startY = start.lat;
    const endX = end.lon * scale;
    const endY = end.lat;
    const pointX = point.lon * scale;
    const pointY = point.lat;
    const dx = endX - startX;
    const dy = endY - startY;
    const segmentLengthSq = dx * dx + dy * dy;
    const t = segmentLengthSq === 0 ? 0 : Math.min(Math.max(((pointX - startX) * dx + (pointY - startY) * dy) / segmentLengthSq, 0), 1);
    const projectedX = startX + dx * t;
    const projectedY = startY + dy * t;
    const distanceSq = (pointX - projectedX) ** 2 + (pointY - projectedY) ** 2;

    if (distanceSq < bestDistanceSq) {
      bestDistanceSq = distanceSq;
      bestAlongKm = traversedKm + segmentKm * t;
    }

    traversedKm += segmentKm;
  }

  return totalKm === 0 ? 0 : Math.min(Math.max(bestAlongKm / totalKm, 0), 1);
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(() => getCurrentSession());
  const [network, setNetwork] = useState<TransportNetwork | null>(null);
  const [networkError, setNetworkError] = useState('');
  const [tripRecords, setTripRecords] = useState<TripRecord[]>([]);

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

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  if (!network) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Chargement UrbanFlow</CardTitle>
            <CardDescription>
              {networkError || 'Synchronisation des flux GTFS, stations partagees et incidents.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
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
      onTripSaved={(option) => {
        const record = createTripRecord(user.id, option);
        setTripRecords(saveTripRecord(record));
      }}
      onTripHistoryClear={() => {
        clearTripHistory(user.id);
        setTripRecords([]);
      }}
      onAccountDelete={() => {
        deleteLocalAccount(user.id);
        setUser(null);
      }}
    />
  );
}

function MobilityMapApp({
  user,
  network,
  tripRecords,
  onLogout,
  onProfileSave,
  onTripSaved,
  onTripHistoryClear,
  onAccountDelete,
}: {
  user: SessionUser;
  network: TransportNetwork;
  tripRecords: TripRecord[];
  onLogout: () => void;
  onProfileSave: (profile: MobilityProfile) => void;
  onTripSaved: (option: RouteOption) => void;
  onTripHistoryClear: () => void;
  onAccountDelete: () => void;
}) {
  const [origin, setOrigin] = useState<GeoPoint>({ ...LANDMARKS[0], label: 'Position demo Bellecour' });
  const [destination, setDestination] = useState<GeoPoint>(LANDMARKS[1]);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [liveRoutes, setLiveRoutes] = useState<RouteOption[]>([]);
  const [routeRequested, setRouteRequested] = useState(false);
  const [routingApiStatus, setRoutingApiStatus] = useState('En attente');
  const [overviewSignal, setOverviewSignal] = useState(0);
  const [trackingId, setTrackingId] = useState<number | null>(null);
  const [geoStatus, setGeoStatus] = useState('GPS non active');
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [savedRouteId, setSavedRouteId] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [navigationRouteId, setNavigationRouteId] = useState('');
  const [navigationRouteSnapshot, setNavigationRouteSnapshot] = useState<RouteOption | null>(null);
  const [navigationError, setNavigationError] = useState('');
  const [, setSearchHistory] = useState<SearchHistoryEntry[]>(() => loadSearchHistory(user.id));
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteRecord[]>(() => loadSavedRoutes(user.id));
  const [savedRoutesOpen, setSavedRoutesOpen] = useState(false);
  const [enabledModes, setEnabledModes] = useState<MobilityMode[]>(ALL_MOBILITY_MODES);

  const localRoutes = useMemo(
    () =>
      routeRequested
        ? planRoutes({
            origin,
            destination,
            profile: user.profile,
            network,
          })
        : [],
    [destination, network, origin, routeRequested, user.profile],
  );
  const candidateRoutes = liveRoutes.length > 0 ? liveRoutes : localRoutes;
  const routes = candidateRoutes.filter((routeOption) => {
    const primaryModes = routeOption.modes.filter((mode) => mode !== 'walk');
    return primaryModes.length === 0 ? enabledModes.includes('walk') : primaryModes.every((mode) => enabledModes.includes(mode));
  });
  const selectedRoute = routes.find((routeOption) => routeOption.id === selectedRouteId) ?? routes[0] ?? null;
  const navigationActive = Boolean(navigationRouteId && navigationRouteSnapshot);
  const activeRoute = navigationActive && navigationRouteSnapshot ? navigationRouteSnapshot : selectedRoute;
  const mapRoutes = navigationActive && navigationRouteSnapshot ? routes.map((routeOption) => (routeOption.id === navigationRouteSnapshot.id ? navigationRouteSnapshot : routeOption)) : routes;
  const navigationProgress = navigationActive && navigationRouteSnapshot && currentPosition ? routeProgressForPoint(navigationRouteSnapshot.path, currentPosition) : 0;
  const distanceReferencePoint = navigationActive && currentPosition ? currentPosition : origin;
  const distanceToDestinationKm = haversineDistanceKm(distanceReferencePoint, destination);
  const carbonSummary = summarizeCarbon(tripRecords, user.profile.carbonGoalGramsPerWeek);
  const nextInstruction = activeRoute?.instructions[0] ?? null;
  const mobileInstruction = activeRoute ? (navigationActive ? navigationInstruction(activeRoute, navigationProgress) : nextInstruction) : null;
  const navigationPoint = currentPosition ? { ...currentPosition, label: 'Ma position' } : null;
  const distanceToStartMeters = currentPosition ? Math.round(haversineDistanceKm(currentPosition, origin) * 1000) : null;
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  useEffect(() => {
    if (!routeRequested) {
      setLiveRoutes([]);
      setRoutingApiStatus('En attente');
      return;
    }

    const controller = new AbortController();
    setRoutingApiStatus('Calcul OSRM en cours');
    enhanceRoutesWithLiveRouting(localRoutes, origin, destination, controller.signal)
      .then((enhancedRoutes) => {
        setLiveRoutes(enhancedRoutes);
        const hasLiveGeometry = enhancedRoutes.some((routeOption, index) => routeOption.path !== localRoutes[index]?.path);
        setRoutingApiStatus(hasLiveGeometry ? 'Trace OSRM active' : 'Trace locale');
      })
      .catch(() => {
        setLiveRoutes(localRoutes);
        setRoutingApiStatus('Trace locale');
      });

    return () => controller.abort();
  }, [destination, localRoutes, origin, routeRequested]);

  useEffect(() => {
    if (!selectedRoute || selectedRoute.id === selectedRouteId) {
      return;
    }
    setSelectedRouteId(selectedRoute.id);
  }, [selectedRoute, selectedRouteId]);

  useEffect(
    () => () => {
      if (trackingId !== null) {
        navigator.geolocation.clearWatch(trackingId);
      }
    },
    [trackingId],
  );

  useEffect(() => {
    if (!navigationRouteId || routes.some((routeOption) => routeOption.id === navigationRouteId)) {
      return;
    }
    setNavigationRouteId('');
    setNavigationRouteSnapshot(null);
  }, [navigationRouteId, routes]);

  useEffect(() => {
    if (navigationError && distanceToStartMeters !== null && distanceToStartMeters <= NAVIGATION_START_RADIUS_METERS) {
      setNavigationError('');
    }
  }, [distanceToStartMeters, navigationError]);

  const applyGpsPosition = (position: GeolocationPosition) => {
    const point = {
      label: 'Ma position',
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracyMeters: position.coords.accuracy,
    };
    setCurrentPosition(point);
    setGeoStatus(`GPS actif - precision ${Math.round(position.coords.accuracy)} m`);
    return point;
  };

  const requestCurrentPosition = () =>
    new Promise<GeoPoint | null>((resolve) => {
      if (!navigator.geolocation) {
        setGeoStatus('GPS indisponible');
        resolve(null);
        return;
      }

      setGeoStatus('GPS en cours de synchronisation');
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(applyGpsPosition(position)),
        (error) => {
          setGeoStatus(`GPS refuse: ${error.message}`);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000,
        },
      );
    });

  const startGeolocation = () => {
    if (trackingId !== null) {
      setGeoStatus('GPS actif');
      return;
    }

    if (!navigator.geolocation) {
      setGeoStatus('GPS indisponible, position demo conservee');
      return;
    }

    const id = navigator.geolocation.watchPosition(
      applyGpsPosition,
      (error) => {
        setGeoStatus(`GPS refuse: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      },
    );
    setTrackingId(id);
    setGeoStatus('GPS en cours de synchronisation');
  };

  const stopGeolocation = () => {
    if (trackingId !== null) {
      navigator.geolocation.clearWatch(trackingId);
      setTrackingId(null);
      setGeoStatus('GPS arrete');
    }
  };

  const recordSearch = (nextOrigin: GeoPoint, nextDestination: GeoPoint) => {
    setSearchHistory((currentEntries) => {
      const nextEntries = upsertSearchHistory(currentEntries, nextOrigin, nextDestination);
      saveSearchHistory(user.id, nextEntries);
      return nextEntries;
    });
  };

  const saveTrip = (routeOption: RouteOption) => {
    const savedRouteRecord = createSavedRouteRecord(user.id, origin, destination, routeOption);
    setSavedRoutes(saveSavedRouteRecord(savedRouteRecord));
    recordSearch(origin, destination);
    onTripSaved(routeOption);
    setSavedRouteId(routeOption.id);
    window.setTimeout(() => setSavedRouteId(''), 1800);
  };

  const selectOrigin = (point: GeoPoint) => {
    setNavigationRouteId('');
    setNavigationRouteSnapshot(null);
    setNavigationError('');
    setRouteRequested(true);
    setOrigin(point);
    recordSearch(point, destination);
  };

  const selectDestination = (point: GeoPoint) => {
    setNavigationRouteId('');
    setNavigationRouteSnapshot(null);
    setNavigationError('');
    setRouteRequested(true);
    setDestination(point);
    recordSearch(origin, point);
  };

  const selectSavedRoute = (entry: SavedRouteRecord) => {
    setNavigationRouteId('');
    setNavigationRouteSnapshot(null);
    setNavigationError('');
    setRouteRequested(true);
    setOrigin(entry.origin);
    setDestination(entry.destination);
    setSelectedRouteId(entry.routeId);
    recordSearch(entry.origin, entry.destination);
    setSavedRoutesOpen(false);
  };

  const deleteSavedRoute = (entryId: string) => {
    setSavedRoutes(deleteSavedRouteRecord(user.id, entryId));
  };

  const toggleEnabledMode = (mode: MobilityMode) => {
    setEnabledModes((currentModes) => {
      if (currentModes.includes(mode)) {
        return currentModes.length === 1 ? currentModes : currentModes.filter((item) => item !== mode);
      }
      return [...currentModes, mode];
    });
  };

  const startNavigation = async (routeOption: RouteOption) => {
    setNavigationError('');
    const gpsPoint = currentPosition ?? (await requestCurrentPosition());
    if (!gpsPoint) {
      startGeolocation();
      setNavigationError('GPS requis pour demarrer. Active la localisation puis rapproche-toi du depart.');
      return;
    }

    const startDistanceMeters = Math.round(haversineDistanceKm(gpsPoint, origin) * 1000);
    if (startDistanceMeters > NAVIGATION_START_RADIUS_METERS) {
      if (trackingId === null) {
        startGeolocation();
      }
      setNavigationError(`Depart trop loin: tu es a ${formatMeters(startDistanceMeters)} du point de depart.`);
      return;
    }

    recordSearch(origin, destination);
    setSelectedRouteId(routeOption.id);
    setNavigationRouteId(routeOption.id);
    setNavigationRouteSnapshot(routeOption);
    if (trackingId === null) {
      startGeolocation();
    }
  };

  const stopNavigation = () => {
    setNavigationRouteId('');
    setNavigationRouteSnapshot(null);
    setConfirmExitOpen(false);
  };

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[var(--shell)] text-foreground">
      <div className="hidden h-full w-full lg:grid lg:grid-cols-[var(--left-rail)_minmax(0,1fr)_390px]" style={{ ['--left-rail' as string]: leftRailOpen ? '360px' : '0px' }}>
        <aside className="relative z-20 min-w-0 overflow-hidden bg-[var(--shell)] transition-[width] duration-300">
          <div className="h-full w-[360px]">
            <ShellSidebar
              layers={layers}
              onLayersChange={setLayers}
              network={network}
              user={user}
              onOpenProfile={() => setProfileOpen(true)}
              destination={destination}
              onOriginSelect={selectOrigin}
              onDestinationSelect={selectDestination}
              selectedRoute={activeRoute}
              distanceToDestinationKm={distanceToDestinationKm}
              nextInstruction={navigationActive ? nextInstruction : null}
            />
          </div>
        </aside>

        <section className="relative min-h-0 min-w-0 bg-[var(--shell)]">
          <div className="absolute inset-y-0 left-0 right-3 z-0 overflow-hidden rounded-r-2xl bg-muted">
            <UrbanMap
              origin={origin}
              destination={destination}
              routes={mapRoutes}
              selectedRoute={activeRoute}
              network={network}
              layers={layers}
              overviewSignal={overviewSignal}
              navigationPoint={navigationPoint}
              navigationActive={navigationActive}
            />
          </div>

          <div
            className="pointer-events-none absolute inset-y-0 left-0 right-3 z-10 overflow-hidden transition-[left,right] duration-300"
            style={{ boxShadow: '0 0 0 100vmax var(--shell)' }}
          >
            <div className="relative h-full w-full overflow-hidden rounded-r-2xl">
              <div className="pointer-events-none absolute inset-0 z-20 rounded-r-2xl shadow-[inset_0_0_24px_3px_rgba(0,0,0,0.22)]" />

              <div className="pointer-events-auto absolute left-0 top-0 z-30 w-[min(720px,calc(100%-3rem))]">
                <CommandSearchBar
                  leftRailOpen={leftRailOpen}
                  onToggleLeftRail={() => setLeftRailOpen((current) => !current)}
                  origin={origin}
                  destination={destination}
                  currentPosition={currentPosition}
                  onCurrentPositionRequest={requestCurrentPosition}
                  onOriginSelect={selectOrigin}
                  onDestinationSelect={selectDestination}
                />
                <MergeFillet corner="br" className="right-0 top-0 translate-x-[calc(100%_-_1px)]" />
                <MergeFillet corner="br" className="bottom-0 left-0 translate-y-[calc(100%_-_1px)]" />
              </div>

              <div className="pointer-events-auto absolute bottom-0 left-0 z-30 max-w-[calc(100%-0.5rem)]">
                <div className="relative">
                  <div className="flex max-w-[calc(100vw-780px)] items-center gap-2 overflow-hidden rounded-tr-2xl bg-[var(--shell)] p-1.5 shadow-[0_0_20px_-2px_rgba(0,0,0,0.28)]">
                    <MapStatusBar
                      routingApiStatus={routingApiStatus}
                      geoStatus={geoStatus}
                      onOverview={() => setOverviewSignal((value) => value + 1)}
                    />
                    <DesktopRouteStrip routes={mapRoutes} selectedRoute={activeRoute} onSelect={setSelectedRouteId} />
                  </div>
                  <MergeFillet corner="tr" size={18} className="bottom-0 right-0 translate-x-[calc(100%_-_1px)]" />
                  <MergeFillet corner="tr" size={18} className="left-0 top-0 translate-y-[calc(-100%_+_1px)]" />
                </div>
              </div>

              {navigationActive && activeRoute && nextInstruction ? (
                <div className="pointer-events-auto absolute right-0 top-0 z-30 max-w-[min(420px,calc(100%-0.5rem))]">
                  <NextActionDock destination={destination} routeOption={activeRoute} instruction={nextInstruction} />
                  <MergeFillet corner="bl" className="left-0 top-0 translate-x-[calc(-100%_+_1px)]" />
                  <MergeFillet corner="bl" className="bottom-0 right-0 translate-y-[calc(100%_-_1px)]" />
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <aside className="relative z-20 flex min-h-0 flex-col gap-2 overflow-y-auto bg-[var(--shell)] p-3 pl-0">
          {activeRoute ? (
            <RouteDetailPanel
              routeOption={activeRoute}
              distanceToDestinationKm={distanceToDestinationKm}
              saved={savedRouteId === activeRoute.id}
              onSave={() => saveTrip(activeRoute)}
              onStopGps={stopGeolocation}
              gpsActive={trackingId !== null}
            />
          ) : null}
          <CarbonPanel user={user} records={tripRecords} onClear={onTripHistoryClear} summary={carbonSummary} />
        </aside>
      </div>

      <div className="relative h-full w-full overflow-hidden bg-muted lg:hidden">
        <div className="absolute inset-0">
          <UrbanMap
            origin={origin}
            destination={destination}
            routes={mapRoutes}
            selectedRoute={activeRoute}
            network={network}
            layers={layers}
            overviewSignal={overviewSignal}
            navigationPoint={navigationPoint}
            navigationActive={navigationActive}
          />
        </div>

        {!navigationActive ? (
          <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-start gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <div className="pointer-events-auto relative z-[70] w-full">
              <MobileSearchShell
                origin={origin}
                destination={destination}
                savedRoutesCount={savedRoutes.length}
                currentPosition={currentPosition}
                onOriginSelect={selectOrigin}
                onDestinationSelect={selectDestination}
                onCurrentPositionRequest={requestCurrentPosition}
                onLocate={startGeolocation}
                onOpenSavedRoutes={() => setSavedRoutesOpen(true)}
                onOpenProfile={() => setProfileOpen(true)}
              />
            </div>
            <div className="pointer-events-auto relative z-40 flex h-8 max-w-full items-center gap-2 rounded-full bg-white/95 px-3 text-xs font-semibold text-foreground shadow-soft backdrop-blur-xl">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{geoStatus}</span>
            </div>
          </header>
        ) : null}

        <MobileTripPanel
          destination={destination}
          routeRequested={routeRequested}
          routes={mapRoutes}
          selectedRoute={activeRoute}
          savedRouteId={savedRouteId}
          layers={layers}
          routingApiStatus={routingApiStatus}
          enabledModes={enabledModes}
          navigationActive={navigationActive}
          navigationProgress={navigationProgress}
          navigationInstruction={mobileInstruction}
          navigationError={navigationError}
          distanceToStartMeters={distanceToStartMeters}
          onLayersChange={setLayers}
          onToggleMode={toggleEnabledMode}
          onSelectRoute={setSelectedRouteId}
          onStartNavigation={startNavigation}
          onRequestStopNavigation={() => setConfirmExitOpen(true)}
          onSaveRoute={saveTrip}
          onLocate={startGeolocation}
          onOverview={() => setOverviewSignal((value) => value + 1)}
        />
      </div>
      <ProfileDrawer
        user={user}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onSave={onProfileSave}
        onDeleteAccount={() => {
          setProfileOpen(false);
          onAccountDelete();
        }}
        onLogout={() => {
          setProfileOpen(false);
          onLogout();
        }}
      />
      <SavedRoutesDialog
        open={savedRoutesOpen}
        routes={savedRoutes}
        onOpenChange={setSavedRoutesOpen}
        onSelect={selectSavedRoute}
        onDelete={deleteSavedRoute}
      />
      <ConfirmNavigationExitModal
        open={confirmExitOpen}
        onCancel={() => setConfirmExitOpen(false)}
        onConfirm={stopNavigation}
      />
    </main>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(DEMO_CREDENTIALS.email);
  const [password, setPassword] = useState(DEMO_CREDENTIALS.password);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    try {
      const authenticatedUser =
        mode === 'register'
          ? await registerUser({ displayName, email, password })
          : await loginUser({ email, password });
      onAuthenticated(authenticatedUser);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_18%_12%,oklch(0.93_0.05_130/0.65),transparent_42%),radial-gradient(circle_at_85%_90%,oklch(0.9_0.17_122/0.28),transparent_38%),linear-gradient(160deg,oklch(0.976_0.008_95),oklch(0.955_0.018_110))] p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-float backdrop-blur-xl md:grid-cols-[1.05fr_1fr]">
        <section
          aria-label="Presentation UrbanFlow"
          className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(155deg,oklch(0.34_0.075_165),oklch(0.44_0.09_160)_55%,oklch(0.5_0.1_150))] p-8 text-primary-foreground md:flex"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:radial-gradient(oklch(0.98_0.012_105)_1.2px,transparent_1.2px)] [background-size:22px_22px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-[oklch(0.9_0.17_122/0.35)] blur-3xl"
          />
          <div className="relative flex items-center gap-2.5">
            <span className="grid size-10 place-items-center rounded-2xl bg-[oklch(0.9_0.17_122)] text-[oklch(0.3_0.06_145)] shadow-soft">
              <Navigation className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">UrbanFlow</span>
          </div>
          <div className="relative">
            <h1 className="font-display text-4xl font-semibold leading-[1.06] tracking-tight">
              La ville,
              <br />
              fluide et
              <br />
              <span className="text-[oklch(0.9_0.17_122)]">bas carbone.</span>
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-primary-foreground/78">
              Itineraires multimodaux, velos et trottinettes partages, transport public et suivi carbone reunis dans une seule
              application pour la metropole.
            </p>
          </div>
          <ul className="relative grid gap-2 text-[13px] font-medium text-primary-foreground/92">
            <li className="flex items-center gap-2">
              <Route className="size-4 text-[oklch(0.9_0.17_122)]" aria-hidden="true" />
              Planificateur multimodal temps reel
            </li>
            <li className="flex items-center gap-2">
              <Bike className="size-4 text-[oklch(0.9_0.17_122)]" aria-hidden="true" />
              Velos, trottinettes et arrets GTFS integres
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-[oklch(0.9_0.17_122)]" aria-hidden="true" />
              Donnees protegees, geolocalisation avec consentement
            </li>
          </ul>
        </section>
        <Card className="rounded-none border-0 bg-transparent shadow-none">
          <div className="flex items-center gap-2.5 px-6 pt-6 md:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Navigation className="size-4.5" aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">UrbanFlow</span>
          </div>
          <CardHeader>
            <Badge variant="info" className="w-fit">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Mobilite urbaine intelligente
            </Badge>
            <CardTitle className="font-display text-2xl">UrbanFlow Mobility</CardTitle>
            <CardDescription>Connecte-toi pour ouvrir la carte, les trajets et le suivi carbone.</CardDescription>
          </CardHeader>
          <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Mode d'authentification">
            <Button type="button" variant={mode === 'login' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('login')}>
              Connexion
            </Button>
            <Button type="button" variant={mode === 'register' ? 'default' : 'ghost'} size="sm" onClick={() => setMode('register')}>
              Inscription
            </Button>
          </div>
          <form className="grid gap-3" onSubmit={handleSubmit}>
            {mode === 'register' ? (
              <label className="grid gap-1.5 text-sm font-medium" htmlFor="register-display-name">
                Nom affiche
                <Input
                  id="register-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </label>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="auth-email">
              Email
              <Input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" htmlFor="auth-password">
              Mot de passe
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={12}
                required
              />
            </label>
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy}>
              {busy ? 'Traitement...' : mode === 'register' ? 'Creer le compte' : 'Ouvrir la carte'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setMode('login');
                setEmail(DEMO_CREDENTIALS.email);
                setPassword(DEMO_CREDENTIALS.password);
              }}
            >
              Utiliser le compte demo
            </Button>
          </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function ShellSidebar({
  layers,
  onLayersChange,
  network,
  user,
  onOpenProfile,
  destination,
  onOriginSelect,
  onDestinationSelect,
  selectedRoute,
  distanceToDestinationKm,
  nextInstruction,
}: {
  layers: LayerState;
  onLayersChange: (layers: LayerState) => void;
  network: TransportNetwork;
  user: SessionUser;
  onOpenProfile: () => void;
  destination: GeoPoint;
  onOriginSelect: (point: GeoPoint) => void;
  onDestinationSelect: (point: GeoPoint) => void;
  selectedRoute: RouteOption | null;
  distanceToDestinationKm: number;
  nextInstruction: RouteInstruction | null;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pb-1 pt-3">
        <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
          <Navigation className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="font-display text-[15px] font-semibold tracking-tight">UrbanFlow</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Mobilite urbaine</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3 pt-2">
        <section className="border-b border-border/70" aria-labelledby="sidebar-destination-title">
          <header className="flex min-h-12 items-center gap-2.5 px-4 py-2.5">
            <Navigation className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">1</span>
            <div className="min-w-0">
              <h2 id="sidebar-destination-title" className="text-[13px] font-semibold tracking-normal">
                Destination
              </h2>
              <p className="truncate text-[10px] font-medium text-muted-foreground">Depart, arrivee et trajet actif</p>
            </div>
          </header>
          <DestinationPanel
            destination={destination}
            selectedRoute={selectedRoute}
            distanceToDestinationKm={distanceToDestinationKm}
            nextInstruction={nextInstruction}
            onOriginSelect={onOriginSelect}
            onDestinationSelect={onDestinationSelect}
          />
        </section>
        <section aria-labelledby="sidebar-layers-title">
          <header className="flex min-h-12 items-center gap-2.5 px-4 py-2.5">
            <Layers3 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span className="text-[11px] font-medium tabular-nums text-muted-foreground">2</span>
            <div className="min-w-0">
              <h2 id="sidebar-layers-title" className="text-[13px] font-semibold tracking-normal">
                Couches
              </h2>
              <p className="truncate text-[10px] font-medium text-muted-foreground">Mobilite temps reel</p>
            </div>
          </header>
          <LayerPanel layers={layers} onLayersChange={onLayersChange} network={network} />
        </section>
      </div>
      <div className="shrink-0 px-3 pb-3">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full justify-start rounded-xl"
          onClick={onOpenProfile}
          aria-label="Ouvrir le profil"
        >
          <UserRound className="size-4" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-left">
            <span className="block truncate text-[13px]">Profil</span>
            <span className="block truncate text-[10px] font-medium text-muted-foreground">{user.displayName}</span>
          </span>
        </Button>
      </div>
    </div>
  );
}

function DestinationPanel({
  destination,
  selectedRoute,
  distanceToDestinationKm,
  nextInstruction,
  onOriginSelect,
  onDestinationSelect,
}: {
  destination: GeoPoint;
  selectedRoute: RouteOption | null;
  distanceToDestinationKm: number;
  nextInstruction: RouteInstruction | null;
  onOriginSelect: (point: GeoPoint) => void;
  onDestinationSelect: (point: GeoPoint) => void;
}) {
  return (
    <div className="grid gap-3 p-3">
      <div className="rounded-xl border border-border/70 bg-background/75 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Destination</p>
        <h3 className="mt-1 truncate text-base font-semibold tracking-normal">{destination.label}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {selectedRoute ? `${selectedRoute.title} - ${selectedRoute.durationMinutes} min` : 'Choisis un trajet'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Restant" value={`${distanceToDestinationKm.toFixed(1)} km`} compact />
        <Metric label="Mode" value={modeLabel(selectedRoute?.modes.at(-1))} compact />
      </div>

      {nextInstruction ? (
        <div className="rounded-xl border border-primary/30 bg-primary/8 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-primary">Prochaine action</p>
          <p className="mt-1 text-sm font-semibold">{nextInstruction.text}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dans {formatMeters(nextInstruction.distanceMeters)}
            {nextInstruction.detail ? ` - ${nextInstruction.detail}` : ''}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {LANDMARKS.slice(0, 4).map((point) => (
          <Button key={point.label} type="button" variant="outline" size="sm" onClick={() => onDestinationSelect(point)} className="justify-start">
            <MapPin className="size-3.5" aria-hidden="true" />
            <span className="truncate">{point.label}</span>
          </Button>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => onOriginSelect(LANDMARKS[0])} className="justify-start">
        <Navigation className="size-3.5" aria-hidden="true" />
        Depart Bellecour
      </Button>
    </div>
  );
}

function CommandSearchBar({
  leftRailOpen,
  onToggleLeftRail,
  origin,
  destination,
  currentPosition,
  onCurrentPositionRequest,
  onOriginSelect,
  onDestinationSelect,
}: {
  leftRailOpen: boolean;
  onToggleLeftRail: () => void;
  origin: GeoPoint;
  destination: GeoPoint;
  currentPosition: GeoPoint | null;
  onCurrentPositionRequest: () => Promise<GeoPoint | null>;
  onOriginSelect: (point: GeoPoint) => void;
  onDestinationSelect: (point: GeoPoint) => void;
}) {
  return (
    <div className="flex min-h-14 w-full items-stretch rounded-br-2xl bg-[var(--shell)] p-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggleLeftRail}
        aria-label={leftRailOpen ? 'Masquer le panneau' : 'Afficher le panneau'}
        className="shrink-0 rounded-xl"
      >
        {leftRailOpen ? <PanelLeftClose className="size-4" aria-hidden="true" /> : <PanelLeftOpen className="size-4" aria-hidden="true" />}
      </Button>
      <div className="mx-2 my-1 w-px shrink-0 self-stretch bg-border/80" aria-hidden />
      <div className="flex min-w-0 flex-1 gap-1.5">
        <PlaceSearchBox
          searchOrigin={origin}
          value={origin}
          currentPosition={currentPosition}
          onCurrentPositionRequest={onCurrentPositionRequest}
          onSelect={onOriginSelect}
          inputId="desktop-origin-search"
          placeholder="Adresse de depart"
          className="min-w-0 flex-1"
        />
        <PlaceSearchBox
          searchOrigin={origin}
          value={destination}
          currentPosition={currentPosition}
          onCurrentPositionRequest={onCurrentPositionRequest}
          onSelect={onDestinationSelect}
          inputId="desktop-destination-search"
          placeholder="Adresse d'arrivee"
          className="min-w-0 flex-1"
        />
      </div>
    </div>
  );
}

function MobileSearchShell({
  origin,
  destination,
  savedRoutesCount,
  currentPosition,
  onOriginSelect,
  onDestinationSelect,
  onCurrentPositionRequest,
  onLocate,
  onOpenSavedRoutes,
  onOpenProfile,
}: {
  origin: GeoPoint;
  destination: GeoPoint;
  savedRoutesCount: number;
  currentPosition: GeoPoint | null;
  onOriginSelect: (point: GeoPoint) => void;
  onDestinationSelect: (point: GeoPoint) => void;
  onCurrentPositionRequest: () => Promise<GeoPoint | null>;
  onLocate: () => void;
  onOpenSavedRoutes: () => void;
  onOpenProfile: () => void;
}) {
  return (
    <div className="relative z-[70] grid grid-cols-[2.25rem_minmax(0,1fr)_2rem_2rem_2rem] items-start gap-2 rounded-2xl border border-white/80 bg-white/95 px-2 py-2 shadow-float backdrop-blur-xl">
      <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Navigation className="size-4" aria-hidden="true" />
      </div>
      <div className="grid min-w-0 gap-1">
        <PlaceSearchBox
          searchOrigin={origin}
          value={origin}
          currentPosition={currentPosition}
          onCurrentPositionRequest={onCurrentPositionRequest}
          onSelect={onOriginSelect}
          inputId="mobile-origin-search"
          placeholder="Depart"
          className="min-w-0"
          compact
        />
        <div className="h-px bg-border/70" aria-hidden="true" />
        <PlaceSearchBox
          searchOrigin={origin}
          value={destination}
          currentPosition={currentPosition}
          onCurrentPositionRequest={onCurrentPositionRequest}
          onSelect={onDestinationSelect}
          inputId="mobile-destination-search"
          placeholder="Arrivee"
          className="min-w-0"
          compact
        />
      </div>
      <Button type="button" variant="ghost" size="compactIcon" onClick={onLocate} aria-label="Me localiser">
        <LocateFixed className="size-4" aria-hidden="true" />
      </Button>
      <Button type="button" variant="ghost" size="compactIcon" onClick={onOpenSavedRoutes} aria-label="Ouvrir les trajets enregistres" className="relative">
        <Route className="size-4" aria-hidden="true" />
        {savedRoutesCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
            {Math.min(savedRoutesCount, 9)}
          </span>
        ) : null}
      </Button>
      <Button type="button" variant="ghost" size="compactIcon" onClick={onOpenProfile} aria-label="Ouvrir le profil">
        <UserRound className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

function PlaceSearchBox({
  searchOrigin,
  value,
  currentPosition,
  onCurrentPositionRequest,
  onSelect,
  inputId,
  placeholder,
  className,
  compact = false,
}: {
  searchOrigin: GeoPoint;
  value: GeoPoint;
  currentPosition: GeoPoint | null;
  onCurrentPositionRequest: () => Promise<GeoPoint | null>;
  onSelect: (point: GeoPoint) => void;
  inputId: string;
  placeholder: string;
  className?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState(value.label);
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setQuery(value.label);
  }, [value]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!open || trimmedQuery.length < 2 || trimmedQuery === value.label) {
      setResults([]);
      setStatus('');
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setStatus('Recherche api-adresse');
      searchPlaces(trimmedQuery, searchOrigin, controller.signal)
        .then((items) => {
          setResults(items);
          setStatus(items.length > 0 ? 'Resultats api-adresse' : 'Aucun resultat');
        })
        .catch(() => {
          setResults(
            LANDMARKS.filter((point) => point.label.toLowerCase().includes(trimmedQuery.toLowerCase())).map((point) => ({
              ...point,
              id: point.label,
              context: 'Point local',
              source: 'local' as const,
            })),
          );
          setStatus('Fallback local');
        });
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, searchOrigin, value.label]);

  const handleSelect = (result: PlaceSearchResult) => {
    onSelect({
      label: result.label,
      lat: result.lat,
      lon: result.lon,
    });
    setQuery(result.label);
    setOpen(false);
  };

  const handleCurrentPositionSelect = async () => {
    const gpsPoint = currentPosition ?? (await onCurrentPositionRequest());
    if (!gpsPoint) {
      setStatus('GPS indisponible');
      setOpen(true);
      return;
    }

    const nextPoint = {
      ...gpsPoint,
      label: 'Ma position',
    };
    onSelect(nextPoint);
    setQuery(nextPoint.label);
    setOpen(false);
  };

  const showCurrentPositionOption = open && query.trim().length > 0;
  const showDropdown = open && (showCurrentPositionOption || results.length > 0 || status);

  return (
    <div className={`relative ${className ?? ''}`}>
      <label className="sr-only" htmlFor={inputId}>
        Rechercher une destination
      </label>
      <div className="relative">
        <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${compact ? 'size-3.5' : 'size-4'}`} aria-hidden="true" />
        <Input
          id={inputId}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          placeholder={placeholder}
          className={`${compact ? 'h-7 text-sm' : 'h-10'} border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0`}
          autoComplete="off"
        />
      </div>
      {showDropdown ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] max-h-[min(52dvh,24rem)] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-float">
          {showCurrentPositionOption ? (
            <button
              type="button"
              className="flex w-full items-start gap-3 border-b border-border px-3 py-2 text-left hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                void handleCurrentPositionSelect();
              }}
            >
              <LocateFixed className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">
                <strong className="block truncate text-sm">Ma position</strong>
                <span className="block truncate text-xs text-muted-foreground">
                  {currentPosition ? `GPS actif${currentPosition.accuracyMeters ? ` - ${Math.round(currentPosition.accuracyMeters)} m` : ''}` : 'Utiliser la position GPS'}
                </span>
              </span>
            </button>
          ) : null}
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => handleSelect(result)}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">
                <strong className="block truncate text-sm">{result.label}</strong>
                <span className="block truncate text-xs text-muted-foreground">
                  {result.context || result.source}
                </span>
              </span>
            </button>
          ))}
          {results.length === 0 && status ? <p className="px-3 py-2 text-sm text-muted-foreground">{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function MapStatusBar({
  routingApiStatus,
  geoStatus,
  onOverview,
}: {
  routingApiStatus: string;
  geoStatus: string;
  onOverview: () => void;
}) {
  return (
    <div className="inline-flex shrink-0 items-stretch overflow-hidden rounded-xl bg-muted/35">
      <div className="inline-flex h-9 items-center gap-2 px-3">
        <span className="text-[8px] text-muted-foreground">Routage</span>
        <span className="font-mono text-[10.5px] leading-none text-foreground">{routingApiStatus}</span>
      </div>
      <div className="inline-flex h-9 items-center gap-2 border-l border-foreground/10 px-3">
        <span className="text-[8px] text-muted-foreground">GPS</span>
        <span className="font-mono text-[10.5px] leading-none text-foreground">{geoStatus}</span>
      </div>
      <button
        type="button"
        className="inline-flex h-9 items-center gap-2 border-l border-foreground/10 px-3 text-[10.5px] font-semibold hover:bg-muted/60"
        onClick={onOverview}
      >
        Vue max
      </button>
    </div>
  );
}

function DesktopRouteStrip({
  routes,
  selectedRoute,
  onSelect,
}: {
  routes: RouteOption[];
  selectedRoute: RouteOption | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="flex min-w-0 flex-1 gap-2">
      {routes.map((routeOption) => (
        <RouteChip
          key={routeOption.id}
          routeOption={routeOption}
          selected={routeOption.id === selectedRoute?.id}
          onClick={() => onSelect(routeOption.id)}
        />
      ))}
    </section>
  );
}

function NextActionDock({
  destination,
  routeOption,
  instruction,
}: {
  destination: GeoPoint;
  routeOption: RouteOption;
  instruction: RouteInstruction;
}) {
  return (
    <section className="overflow-hidden rounded-bl-2xl bg-[var(--shell)] p-1.5 shadow-[0_0_20px_-2px_rgba(0,0,0,0.28)]">
      <div className="grid w-[min(390px,36vw)] gap-2 rounded-xl bg-muted/35 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Guidage</p>
            <h2 className="truncate text-sm font-semibold tracking-normal">{destination.label}</h2>
          </div>
          <span className="shrink-0 rounded-lg bg-background/80 px-2 py-1 font-mono text-[10px] font-semibold">
            {routeOption.durationMinutes} min
          </span>
        </div>
        <div className="grid grid-cols-[32px_1fr_auto] items-center gap-2 rounded-lg bg-background/85 p-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Navigation className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm">{instruction.text}</strong>
            <span className="block truncate text-xs text-muted-foreground">{instruction.detail ?? routeOption.title}</span>
          </span>
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
            {formatMeters(instruction.distanceMeters)}
          </span>
        </div>
      </div>
    </section>
  );
}

function MergeFillet({
  corner,
  size = 24,
  className,
}: {
  corner: 'tl' | 'tr' | 'bl' | 'br';
  size?: number;
  className?: string;
}) {
  const at = {
    tl: 'top left',
    tr: 'top right',
    bl: 'bottom left',
    br: 'bottom right',
  }[corner];

  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at ${at}, rgb(from var(--shell) r g b / 0) ${size - 1}px, var(--shell) ${size}px)`,
      }}
    />
  );
}

function formatMeters(distanceMeters: number): string {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(distanceMeters >= 10_000 ? 0 : 1)} km`;
  }
  return `${Math.max(Math.round(distanceMeters / 10) * 10, 10)} m`;
}

function modeLabel(mode?: MobilityMode): string {
  switch (mode) {
    case 'walk':
      return 'Marche';
    case 'bike':
      return 'Velo';
    case 'scooter':
      return 'Trottinette';
    case 'transit':
      return 'Transport';
    case 'carpool':
      return 'Covoiturage';
    default:
      return 'n/a';
  }
}

function LayerPanel({
  layers,
  onLayersChange,
  network,
}: {
  layers: LayerState;
  onLayersChange: (layers: LayerState) => void;
  network: TransportNetwork;
}) {
  const bikeCount = network.sharedMobility.data.stations.reduce((sum, station) => sum + station.bikes_available, 0);
  const scooterCount = network.sharedMobility.data.stations.reduce((sum, station) => sum + station.scooters_available, 0);

  return (
    <div className="px-3 pb-4">
      <div className="grid gap-3">
        <LayerToggle
          label="Arrets GTFS"
          detail={`${network.gtfs.stops.length} arrets publics`}
          active={layers.transitStops}
          color="bg-[#2f6cb3]"
          onClick={() => onLayersChange({ ...layers, transitStops: !layers.transitStops })}
        />
        <LayerToggle
          label="Velos & trottinettes"
          detail={`${bikeCount} velos - ${scooterCount} trottinettes`}
          active={layers.sharedMobility}
          color="bg-[#1d6b4f]"
          onClick={() => onLayersChange({ ...layers, sharedMobility: !layers.sharedMobility })}
        />
        <LayerToggle
          label="Incidents transport"
          detail={`${network.gtfs.incidents.length} alertes actives`}
          active={layers.incidents}
          color="bg-red-500"
          onClick={() => onLayersChange({ ...layers, incidents: !layers.incidents })}
        />
      </div>
      {network.sources?.sharedMobility === 'gbfs-live' ? (
        <div className="mt-4 rounded-lg border border-primary/25 bg-accent px-3 py-2 text-xs text-accent-foreground">
          Donnees live: GBFS Velo'v + Dott ({getFeedFreshness(network.sharedMobility)})
          {network.sources.gtfs === 'tcl-odbl' ? ', GTFS TCL (ODbL)' : ''}
          {network.sources.weather === 'open-meteo' ? ', meteo Open-Meteo' : ''}. Incidents simules (flux SIRI operateur
          sous cle).
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Mode hors ligne: fallback local GBFS/GTFS actif, date: {getFeedFreshness(network.sharedMobility)}.
        </div>
      )}
    </div>
  );
}

function ProfileDrawer({
  user,
  open,
  onOpenChange,
  onSave,
  onDeleteAccount,
  onLogout,
}: {
  user: SessionUser;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (profile: MobilityProfile) => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-[calc(100%-1rem)] max-w-[1400px] overflow-hidden bg-[var(--shell)] p-0 sm:w-[calc(100%-3rem)]">
        <DrawerHeader className="items-center border-b border-border px-6 pb-4 pt-3 text-center sm:text-center">
          <DrawerTitle>Profil et preferences</DrawerTitle>
          <DrawerDescription className="truncate">{user.email}</DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section className="overflow-hidden rounded-xl border border-border bg-background">
              <ProfilePanel user={user} onSave={onSave} onDeleteAccount={onDeleteAccount} />
            </section>
            <section className="grid content-start gap-3 rounded-xl border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <UserRound className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm">{user.displayName}</strong>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                Preferences utilisees pour calculer les trajets, filtrer les options PMR et suivre le carbone.
              </p>
              <Button type="button" variant="destructive" className="w-full justify-center" onClick={onLogout}>
                <LogOut className="size-4" aria-hidden="true" />
                Deconnexion
              </Button>
            </section>
          </div>
        </div>
        <DrawerFooter className="mx-auto w-full max-w-5xl border-t border-border px-5 py-4">
          <DrawerClose asChild>
            <Button type="button" className="w-full justify-center bg-foreground text-background hover:bg-foreground/90">
              Fermer
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function SavedRoutesDialog({
  open,
  routes,
  onOpenChange,
  onSelect,
  onDelete,
}: {
  open: boolean;
  routes: SavedRouteRecord[];
  onOpenChange: (open: boolean) => void;
  onSelect: (route: SavedRouteRecord) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trajets enregistres</DialogTitle>
          <DialogDescription>{routes.length} trajet{routes.length > 1 ? 's' : ''} disponible{routes.length > 1 ? 's' : ''}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(62dvh,520px)] overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {routes.length > 0 ? (
            <div className="grid gap-2">
              {routes.map((routeRecord) => (
                <article key={routeRecord.id} className="grid gap-3 rounded-xl border border-border bg-background p-3">
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold tracking-normal">{routeRecord.routeTitle}</h3>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {routeRecord.origin.label} &gt; {routeRecord.destination.label}
                      </p>
                    </div>
                    <span className="grid size-10 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                      {routeRecord.score}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {routeRecord.modes.map((mode) => {
                      const Icon = MODE_ICON[mode];
                      return (
                        <span key={mode} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-[10px] font-semibold text-foreground">
                          <Icon className="size-3" aria-hidden="true" />
                          {modeLabel(mode)}
                        </span>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Metric label="min" value={String(routeRecord.durationMinutes)} compact />
                    <Metric label="km" value={routeRecord.distanceKm.toFixed(1)} compact />
                    <Metric label="CO2" value={`${routeRecord.carbonGrams}g`} compact />
                  </div>
                  <div className="grid grid-cols-[1fr_2.25rem] gap-2">
                    <Button type="button" size="sm" onClick={() => onSelect(routeRecord)}>
                      <Route className="size-4" aria-hidden="true" />
                      Charger
                    </Button>
                    <Button type="button" variant="outline" size="compactIcon" onClick={() => onDelete(routeRecord.id)} aria-label={`Supprimer ${routeRecord.routeTitle}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/35 px-4 py-8 text-center">
              <Route className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold">Aucun trajet enregistre</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfilePanel({
  user,
  onSave,
  onDeleteAccount,
}: {
  user: SessionUser;
  onSave: (profile: MobilityProfile) => void;
  onDeleteAccount: () => void;
}) {
  const [profile, setProfile] = useState<MobilityProfile>(user.profile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(user.profile);
  }, [user]);

  const toggleMode = (mode: MobilityMode) => {
    setProfile((currentProfile) => ({
      ...currentProfile,
      preferredModes: currentProfile.preferredModes.includes(mode)
        ? currentProfile.preferredModes.filter((item) => item !== mode)
        : [...currentProfile.preferredModes, mode],
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(profile);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  return (
    <section className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground">
          <UserRound className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Profil</p>
          <h2 className="font-semibold">{user.displayName}</h2>
        </div>
      </div>
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <label className="grid gap-1.5 text-sm font-medium" htmlFor="profile-display-name">
          Nom affiche
          <Input
            id="profile-display-name"
            value={profile.displayName}
            onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
          />
        </label>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Modes preferes</legend>
          <div className="grid grid-cols-2 gap-2">
            {MODE_OPTIONS.map((option) => {
              const Icon = MODE_ICON[option.mode];
              const active = profile.preferredModes.includes(option.mode);
              return (
                <button
                  key={option.mode}
                  type="button"
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                    active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                  }`}
                  onClick={() => toggleMode(option.mode)}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <label className="grid gap-1.5 text-sm font-medium">
          Marche max: {profile.maxWalkMinutes} min
          <input
            type="range"
            min="5"
            max="45"
            step="5"
            value={profile.maxWalkMinutes}
            onChange={(event) => setProfile({ ...profile, maxWalkMinutes: Number(event.target.value) })}
            className="accent-primary"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={profile.accessibilityNeed}
            onChange={(event) => setProfile({ ...profile, accessibilityNeed: event.target.checked })}
            className="size-4 accent-primary"
          />
          Priorite PMR
        </label>
        <div className="flex gap-2">
          <Button type="submit" size="sm" className="flex-1">
            {saved ? <Check className="size-4" aria-hidden="true" /> : null}
            Enregistrer
          </Button>
          <Button type="button" variant="outline" size="compactIcon" onClick={onDeleteAccount} aria-label="Supprimer les donnees locales">
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </section>
  );
}

function ConfirmNavigationExitModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="quit-navigation-title">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-background p-4 shadow-float">
        <h2 id="quit-navigation-title" className="text-lg font-semibold tracking-normal">
          Quitter la navigation ?
        </h2>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          Le guidage du trajet en cours sera arrete. Le trajet restera disponible dans les options.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Quitter
          </Button>
        </div>
      </section>
    </div>
  );
}

function RouteDetailPanel({
  routeOption,
  distanceToDestinationKm,
  saved,
  onSave,
  onStopGps,
  gpsActive,
}: {
  routeOption: RouteOption;
  distanceToDestinationKm: number;
  saved: boolean;
  onSave: () => void;
  onStopGps: () => void;
  gpsActive: boolean;
}) {
  const visibleLegs = routeOption.legs.filter((leg) => leg.distanceKm >= 0.05 || leg.mode !== 'walk');

  return (
    <section className="overflow-hidden rounded-xl border border-primary/80 bg-muted/20">
      <div className="border-b border-border/50 px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-center gap-2">
              <ShieldCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="truncate text-[11px] font-semibold text-emerald-700">
                {routeOption.accessible ? 'PMR compatible' : 'PMR limite'}
              </span>
            </div>
            <h2 className="truncate text-[15px] font-semibold tracking-normal">{routeOption.title}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{routeOption.summary}</p>
          </div>
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white"
            style={{ background: getRouteColor(routeOption) }}
          >
            {routeOption.score}
          </span>
        </div>
      </div>
      <div className="grid gap-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Duree" value={`${routeOption.durationMinutes} min`} />
          <Metric label="Distance" value={`${routeOption.distanceKm.toFixed(1)} km`} />
          <Metric label="CO2" value={`${routeOption.carbonGrams} g`} />
          <Metric label="Reste a vol d'oiseau" value={`${distanceToDestinationKm.toFixed(1)} km`} />
        </div>
        <ol className="grid gap-2">
          {visibleLegs.map((leg) => {
            const Icon = MODE_ICON[leg.mode];
            return (
              <li key={leg.id} className="grid grid-cols-[30px_1fr] gap-2.5 rounded-lg border border-border/70 bg-background/70 p-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block text-sm">{leg.title}</strong>
                  <span className="block text-xs text-muted-foreground">
                    {leg.from}
                    {' -> '}
                    {leg.to}. {leg.detail}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        {routeOption.warnings.length > 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {routeOption.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" onClick={onSave}>
            {saved ? <Check className="size-4" aria-hidden="true" /> : <Route className="size-4" aria-hidden="true" />}
            {saved ? 'Enregistre' : 'Sauver trajet'}
          </Button>
          <Button type="button" variant="outline" onClick={onStopGps} disabled={!gpsActive}>
            Stop GPS
          </Button>
        </div>
      </div>
    </section>
  );
}

function CarbonPanel({
  user,
  records,
  summary,
  onClear,
}: {
  user: SessionUser;
  records: TripRecord[];
  summary: ReturnType<typeof summarizeCarbon>;
  onClear: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
      <div className="border-b border-border/50 px-3 py-3">
        <h2 className="text-[15px] font-semibold tracking-normal">Suivi carbone</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {summary.goalUsagePercent}% de l'objectif hebdomadaire de {user.profile.carbonGoalGramsPerWeek} g.
        </p>
      </div>
      <div className="grid gap-3 p-3">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <span className="block h-full bg-primary" style={{ width: `${Math.min(summary.goalUsagePercent, 100)}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Trajets" value={String(summary.trips)} />
          <Metric label="CO2 evite" value={`${summary.totalSavedGrams} g`} />
        </div>
        {records.length > 0 ? (
          <ul className="grid gap-2 text-sm">
            {records.slice(0, 3).map((record) => (
              <li key={record.id} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                <span>{record.routeTitle}</span>
                <strong>{record.carbonGrams} g</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Sauve un trajet pour alimenter le suivi.</p>
        )}
        <Button type="button" variant="outline" size="sm" onClick={onClear} disabled={records.length === 0}>
          Effacer l'historique
        </Button>
      </div>
    </section>
  );
}

function MobileTripPanel({
  destination,
  routeRequested,
  routes,
  selectedRoute,
  savedRouteId,
  layers,
  routingApiStatus,
  enabledModes,
  navigationActive,
  navigationProgress,
  navigationInstruction,
  navigationError,
  distanceToStartMeters,
  onLayersChange,
  onToggleMode,
  onSelectRoute,
  onStartNavigation,
  onRequestStopNavigation,
  onSaveRoute,
  onLocate,
  onOverview,
}: {
  destination: GeoPoint;
  routeRequested: boolean;
  routes: RouteOption[];
  selectedRoute: RouteOption | null;
  savedRouteId: string;
  layers: LayerState;
  routingApiStatus: string;
  enabledModes: MobilityMode[];
  navigationActive: boolean;
  navigationProgress: number;
  navigationInstruction: RouteInstruction | null;
  navigationError: string;
  distanceToStartMeters: number | null;
  onLayersChange: (layers: LayerState) => void;
  onToggleMode: (mode: MobilityMode) => void;
  onSelectRoute: (id: string) => void;
  onStartNavigation: (routeOption: RouteOption) => void | Promise<void>;
  onRequestStopNavigation: () => void;
  onSaveRoute: (routeOption: RouteOption) => void;
  onLocate: () => void;
  onOverview: () => void;
}) {
  const [sheetLevel, setSheetLevel] = useState<MobileSheetLevel>('mid');
  const dragStartY = useRef<number | null>(null);
  const dragMoved = useRef(false);
  const sheetSizing = MOBILE_SHEET_HEIGHT[sheetLevel];
  const activeSizing = navigationActive ? { shell: 'max-h-[46dvh]', content: 'max-h-[calc(46dvh-0.5rem)]' } : sheetSizing;
  const isCollapsed = sheetLevel === 'collapsed';

  useEffect(() => {
    if (navigationActive) {
      setSheetLevel('collapsed');
    }
  }, [navigationActive]);

  const moveSheet = (direction: -1 | 1) => {
    setSheetLevel((current) => shiftMobileSheetLevel(current, direction));
  };

  const handleSheetPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStartY.current = event.clientY;
    dragMoved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSheetPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragStartY.current === null) {
      return;
    }
    if (Math.abs(event.clientY - dragStartY.current) > 8) {
      dragMoved.current = true;
    }
  };

  const handleSheetPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const startY = dragStartY.current;
    dragStartY.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (startY === null) {
      return;
    }

    const deltaY = event.clientY - startY;
    if (Math.abs(deltaY) > 36) {
      moveSheet(deltaY < 0 ? 1 : -1);
      return;
    }

    if (!dragMoved.current) {
      moveSheet(sheetLevel === 'expanded' ? -1 : 1);
    }
  };

  const handleSheetPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    dragStartY.current = null;
    dragMoved.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSheetKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSheet(1);
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSheet(-1);
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      moveSheet(sheetLevel === 'expanded' ? -1 : 1);
    }
  };

  return (
    <section
      className={`absolute inset-x-0 bottom-0 z-30 overflow-hidden rounded-t-[1.6rem] border border-white/80 bg-white/96 pb-[env(safe-area-inset-bottom)] shadow-float backdrop-blur-xl transition-[max-height] duration-300 ease-in-out ${activeSizing.shell}`}
    >
      <div className="flex h-7 items-center justify-center">
        <button
          type="button"
          className="flex h-7 w-24 touch-none cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
          aria-label="Monter ou baisser le panneau trajets"
          data-testid="mobile-trip-sheet-handle"
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={handleSheetPointerUp}
          onPointerCancel={handleSheetPointerCancel}
          onKeyDown={handleSheetKeyDown}
        >
          <span className="h-1.5 w-12 rounded-full bg-muted-foreground/25" aria-hidden="true" />
        </button>
      </div>
      <div className={`${activeSizing.content} overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {!navigationActive ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Trajets disponibles</p>
              <h1 className="truncate text-lg font-semibold tracking-normal">{destination.label}</h1>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onLocate} className="shrink-0 rounded-full bg-white">
              <LocateFixed className="size-4" aria-hidden="true" />
              GPS
            </Button>
          </div>
        ) : null}

        {!isCollapsed && !navigationActive ? (
          <>
            <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <LayerPill active={layers.transitStops} onClick={() => onLayersChange({ ...layers, transitStops: !layers.transitStops })}>
                Arrets
              </LayerPill>
              <LayerPill active={layers.sharedMobility} onClick={() => onLayersChange({ ...layers, sharedMobility: !layers.sharedMobility })}>
                Velos
              </LayerPill>
              <LayerPill active={layers.incidents} onClick={() => onLayersChange({ ...layers, incidents: !layers.incidents })}>
                Incidents
              </LayerPill>
              <LayerPill active={routingApiStatus.includes('OSRM')} onClick={() => undefined}>
                {routingApiStatus}
              </LayerPill>
              <LayerPill active onClick={onOverview}>
                Vue max
              </LayerPill>
            </div>
            <MobileModeComposer enabledModes={enabledModes} onToggleMode={onToggleMode} />
          </>
        ) : null}

        {navigationActive && selectedRoute ? (
          <MobileNavigationStatus
            routeOption={selectedRoute}
            instruction={navigationInstruction}
            progress={navigationProgress}
            onRequestStop={onRequestStopNavigation}
          />
        ) : (
          <>
            {routes.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 px-4 pb-3">
                {routes.slice(0, 4).map((routeOption) => (
                  <MobileRouteTab
                    key={routeOption.id}
                    routeOption={routeOption}
                    selected={routeOption.id === selectedRoute?.id}
                    onSelect={() => onSelectRoute(routeOption.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="px-4 pb-3">
                <div className="rounded-xl border border-border bg-background/80 px-3 py-3 text-sm font-medium text-muted-foreground">
                  {routeRequested ? 'Aucun trajet pour cette combinaison.' : 'Choisis un depart ou une destination pour calculer un trajet.'}
                </div>
              </div>
            )}
            {selectedRoute ? (
              <MobileRouteActions
                routeOption={selectedRoute}
                saved={selectedRoute.id === savedRouteId}
                distanceToStartMeters={distanceToStartMeters}
                error={navigationError}
                onSave={() => onSaveRoute(selectedRoute)}
                onStart={() => {
                  setSheetLevel('collapsed');
                  void onStartNavigation(selectedRoute);
                }}
              />
            ) : null}
          </>
        )}

        {!isCollapsed && !navigationActive ? (
          <div className="px-4 pb-3">
            {selectedRoute ? (
              <MobileSelectedRouteCard
                routeOption={selectedRoute}
                expanded={sheetLevel === 'expanded'}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MobileModeComposer({
  enabledModes,
  onToggleMode,
}: {
  enabledModes: MobilityMode[];
  onToggleMode: (mode: MobilityMode) => void;
}) {
  return (
    <div className="px-4 pb-3">
      <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MODE_OPTIONS.map((option) => {
          const Icon = MODE_ICON[option.mode];
          const active = enabledModes.includes(option.mode);
          return (
            <button
              key={option.mode}
              type="button"
              className={`flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
              }`}
              onClick={() => onToggleMode(option.mode)}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MobileRouteTab({
  routeOption,
  selected,
  onSelect,
}: {
  routeOption: RouteOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = MODE_ICON[routeOption.modes.at(-1) ?? 'walk'];

  return (
    <button
      type="button"
      className={`grid h-14 min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-xl border px-2.5 text-left transition ${
        selected ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 bg-background text-foreground'
      }`}
      onClick={onSelect}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: getRouteColor(routeOption) }}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-xs">{routeOption.title}</strong>
        <span className="block truncate font-mono text-[10px] text-muted-foreground">
          {routeOption.durationMinutes} min - {routeOption.distanceKm.toFixed(1)} km
        </span>
      </span>
    </button>
  );
}

function MobileRouteActions({
  routeOption,
  saved,
  distanceToStartMeters,
  error,
  onSave,
  onStart,
}: {
  routeOption: RouteOption;
  saved: boolean;
  distanceToStartMeters: number | null;
  error: string;
  onSave: () => void;
  onStart: () => void;
}) {
  const closeToStart = distanceToStartMeters !== null && distanceToStartMeters <= NAVIGATION_START_RADIUS_METERS;

  return (
    <div className="grid gap-2 px-4 pb-3">
      <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
        <Button type="button" variant="outline" size="sm" className="bg-white" onClick={onSave}>
          {saved ? <Check className="size-4" aria-hidden="true" /> : <Route className="size-4" aria-hidden="true" />}
          {saved ? 'Enregistre' : 'Enregistrer'}
        </Button>
        <Button type="button" size="sm" onClick={onStart}>
          <Navigation className="size-4" aria-hidden="true" />
          Commencer le trajet
        </Button>
      </div>
      <div className={`rounded-xl border px-3 py-2 text-xs ${error ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-border/70 bg-background/80 text-muted-foreground'}`}>
        {error ||
          (distanceToStartMeters === null
            ? 'GPS requis pour verifier le point de depart.'
            : closeToStart
              ? `Depart valide: tu es a ${formatMeters(distanceToStartMeters)}.`
              : `Rapproche-toi du depart: ${formatMeters(distanceToStartMeters)} restants.`)}
      </div>
      <p className="sr-only">{routeOption.title}</p>
    </div>
  );
}

function MobileNavigationStatus({
  routeOption,
  instruction,
  progress,
  onRequestStop,
}: {
  routeOption: RouteOption;
  instruction: RouteInstruction | null;
  progress: number;
  onRequestStop: () => void;
}) {
  const remainingRatio = Math.max(1 - progress, 0);
  const remainingMinutes = Math.max(Math.ceil(routeOption.durationMinutes * remainingRatio), 1);
  const remainingKm = Math.max(routeOption.distanceKm * remainingRatio, 0);

  return (
    <div className="px-4 pb-3">
      <div className="rounded-2xl border border-primary bg-primary/8 p-3 shadow-soft">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">Guidage en cours</p>
            <h2 className="truncate text-lg font-semibold tracking-normal">{instruction?.text ?? routeOption.title}</h2>
            <p className="mt-1 truncate text-xs text-muted-foreground">{instruction?.detail ?? routeOption.summary}</p>
          </div>
          <Button type="button" variant="outline" size="sm" className="rounded-full bg-white" onClick={onRequestStop}>
            Quitter
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Metric label="reste" value={`${remainingMinutes} min`} compact />
          <Metric label="distance" value={`${remainingKm.toFixed(1)} km`} compact />
          <Metric label="progression" value={`${Math.round(progress * 100)}%`} compact />
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-primary/12">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(Math.max(progress * 100, 3), 100)}%` }} />
        </div>
      </div>
    </div>
  );
}

function MobileSelectedRouteCard({
  routeOption,
  expanded,
}: {
  routeOption: RouteOption;
  expanded: boolean;
}) {
  return (
    <article className="rounded-xl border border-primary bg-primary/8 p-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold tracking-normal">{routeOption.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">{routeOption.summary}</p>
        </div>
        <span className="grid size-11 place-items-center rounded-xl text-base font-bold text-white" style={{ background: getRouteColor(routeOption) }}>
          {routeOption.score}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <Metric label="min" value={String(routeOption.durationMinutes)} compact />
        <Metric label="km" value={routeOption.distanceKm.toFixed(1)} compact />
        <Metric label="CO2" value={`${routeOption.carbonGrams}g`} compact />
        <Metric label="gain" value={`${routeOption.carbonSavedGrams}g`} compact />
      </div>
      {expanded && routeOption.instructions.length > 0 ? (
        <div className="mt-3 rounded-lg border border-border/70 bg-background/75 p-2.5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Prochaines actions</p>
          <ol className="mt-2 grid gap-2">
            {routeOption.instructions.slice(0, 4).map((instruction, index) => (
              <li key={`${instruction.kind}-${instruction.distanceMeters}-${index}`} className="flex min-w-0 items-start gap-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-xs">{instruction.text}</strong>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    Dans {formatMeters(instruction.distanceMeters)}
                    {instruction.detail ? ` - ${instruction.detail}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </article>
  );
}

function RouteChip({ routeOption, selected, onClick }: { routeOption: RouteOption; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${
        selected ? 'bg-primary/10 text-primary' : 'bg-muted/35 hover:bg-muted/60'
      }`}
      onClick={onClick}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: getRouteColor(routeOption) }}>
        {routeOption.durationMinutes}
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-sm">{routeOption.title}</strong>
        <span className="block truncate text-xs text-muted-foreground">
          {routeOption.distanceKm.toFixed(1)} km - {routeOption.carbonGrams} g CO2
        </span>
      </span>
    </button>
  );
}

function LayerToggle({
  label,
  detail,
  active,
  color,
  onClick,
}: {
  label: string;
  detail: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
        active ? 'border-primary/30 bg-primary/8' : 'border-border bg-background'
      }`}
      onClick={onClick}
    >
      <span className="flex items-center gap-3">
        <span className={`size-3 rounded-full ${color}`} />
        <span>
          <strong className="block text-sm">{label}</strong>
          <span className="block text-xs text-muted-foreground">{detail}</span>
        </span>
      </span>
      <span className={`size-2 rounded-full ${active ? 'bg-primary' : 'bg-border'}`} />
    </button>
  );
}

function LayerPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
        active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-border/70 bg-background/75 ${compact ? 'px-2 py-1.5' : 'p-2.5'}`}>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-bold">{value}</dd>
    </div>
  );
}

export default App;
