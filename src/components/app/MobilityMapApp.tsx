// Orchestrateur principal : recherche d'itineraires, comparaison des options et
// planification des trajets (dates, recurrents, objectifs). Auth geree par App.
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import type {
  GeoPoint,
  MobilityMode,
  MobilityProfile,
  PlannedTrip,
  RecurringTrip,
  RouteOption,
  SavedRouteRecord,
  SessionUser,
  TransportNetwork,
  TripRecord,
} from '../../types';
import { enhanceRoutesWithLiveRouting } from '../../lib/transport';
import { createSavedRouteRecord, deleteSavedRouteRecord, loadSavedRoutes, saveSavedRouteRecord } from '../../lib/savedRoutes';
import { haversineDistanceKm, matchesEnabledModes, planRoutes } from '../../lib/planner';
import { CITY_CENTER, METRO_RADIUS_KM } from '../../lib/transport';
import { summarizeCarbon } from '../../lib/carbon';
import {
  createPlannedTrip,
  createRecurringTrip,
  deletePlannedTrip,
  deleteRecurringTrip,
  loadRecurringTrips,
  plannedTripToRecord,
  prunePlannedForRecurring,
  savePlannedTrip,
  saveRecurringTrip,
  setPlannedTripStatus,
  setRecurringTripPaused,
  summarizeTripActivity,
  syncRecurringOccurrences,
  upcomingTrips,
  type TripSource,
} from '../../lib/plannedTrips';
import { UrbanMap, ALL_MOBILITY_MODES, DEFAULT_LAYERS, MergeFillet, type LayerState } from './shared';
import { ShellSidebar } from '../layout/Shell';
import { CommandSearchBar, MobileSearchShell } from '../planner/SearchPanels';
import { DesktopRouteStrip, MapStatusBar, RouteDetailPanel } from '../planner/RoutePanels';
import { MobileTripPanel } from '../planner/MobilePanels';
import { PlanTripDialog, TripsHubDialog, type PlanTripSubmit, type TripsHubTab } from '../planner/trips';
import { CarbonPanel } from '../carbon/CarbonPanel';
import { ProfileDrawer } from '../profile/ProfilePanels';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

export function MobilityMapApp({
  user,
  network,
  tripRecords,
  onLogout,
  onProfileSave,
  onTripCompleted,
  onTripHistoryClear,
  onAccountDelete }: {
  user: SessionUser;
  network: TransportNetwork;
  tripRecords: TripRecord[];
  onLogout: () => void;
  onProfileSave: (profile: MobilityProfile) => void;
  onTripCompleted: (record: TripRecord) => void;
  onTripHistoryClear: () => void;
  onAccountDelete: () => void;
}) {
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [destination, setDestination] = useState<GeoPoint | null>(null);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [liveRoutes, setLiveRoutes] = useState<RouteOption[]>([]);
  const [routingApiStatus, setRoutingApiStatus] = useState('En attente');
  const [geoStatus, setGeoStatus] = useState('GPS non demande');
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [savedRouteId, setSavedRouteId] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRouteRecord[]>(() => loadSavedRoutes(user.id));
  const [enabledModes, setEnabledModes] = useState<MobilityMode[]>(ALL_MOBILITY_MODES);

  // Planification : occurrences datees + routines recurrentes.
  const [plannedTrips, setPlannedTrips] = useState<PlannedTrip[]>(() => syncRecurringOccurrences(user.id));
  const [recurringTrips, setRecurringTrips] = useState<RecurringTrip[]>(() => loadRecurringTrips(user.id));
  const [tripsHub, setTripsHub] = useState<{ open: boolean; tab: TripsHubTab }>({ open: false, tab: 'upcoming' });
  const [planSource, setPlanSource] = useState<TripSource | null>(null);
  const [tutorialSignal, setTutorialSignal] = useState(0);
  const watchIdRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    },
    [],
  );

  const routeRequested = Boolean(origin && destination);

  const localRoutes = useMemo(
    () =>
      origin && destination
        ? planRoutes({
            origin,
            destination,
            profile: user.profile,
            network })
        : [],
    [destination, network, origin, user.profile],
  );
  const candidateRoutes = liveRoutes.length > 0 ? liveRoutes : localRoutes;
  const routes = candidateRoutes.filter((routeOption) => matchesEnabledModes(routeOption, enabledModes));
  const selectedRoute = routes.find((routeOption) => routeOption.id === selectedRouteId) ?? routes[0] ?? null;
  const carbonSummary = summarizeCarbon(tripRecords, user.profile.carbonGoalGramsPerWeek);
  const activitySummary = useMemo(() => summarizeTripActivity(plannedTrips, recurringTrips), [plannedTrips, recurringTrips]);
  const upcoming = useMemo(() => upcomingTrips(plannedTrips), [plannedTrips]);
  const navigationPoint = currentPosition ? { ...currentPosition, label: 'Ma position' } : null;

  // Perimetre produit: la recherche est bornee a la metropole, mais la position
  // GPS peut en sortir. On previent honnetement que l'offre y est reduite.
  const outsideMetro = [origin, destination].some(
    (point) => point && haversineDistanceKm(point, CITY_CENTER) > METRO_RADIUS_KM + 4,
  );
  const coverageWarning = routeRequested && outsideMetro
    ? 'Hors metropole de Lyon : transport public et velos/trottinettes indisponibles, options limitees a la marche et au covoiturage.'
    : null;

  useEffect(() => {
    if (!origin || !destination) {
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
  }, [destination, localRoutes, origin]);

  useEffect(() => {
    if (!selectedRoute || selectedRoute.id === selectedRouteId) {
      return;
    }
    setSelectedRouteId(selectedRoute.id);
  }, [selectedRoute, selectedRouteId]);

  const applyGpsPosition = (position: GeolocationPosition): GeoPoint => {
    const point = {
      label: 'Ma position',
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      accuracyMeters: position.coords.accuracy };
    setCurrentPosition(point);
    setGeoStatus(`GPS ok - precision ${Math.round(position.coords.accuracy)} m`);
    return point;
  };

  // Apres la premiere position, un suivi leger tient le repere "Ma position"
  // a jour sur la carte (pas de guidage: uniquement l'affichage temps reel).
  const startPositionWatch = () => {
    if (watchIdRef.current !== null || !navigator.geolocation) {
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      applyGpsPosition,
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  };

  const requestCurrentPosition = () =>
    new Promise<GeoPoint | null>((resolve) => {
      if (!navigator.geolocation) {
        setGeoStatus('GPS indisponible');
        resolve(null);
        return;
      }

      setGeoStatus('GPS en cours');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = applyGpsPosition(position);
          startPositionWatch();
          resolve(point);
        },
        (error) => {
          setGeoStatus(`GPS refuse: ${error.message}`);
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000 },
      );
    });

  const selectOrigin = (point: GeoPoint) => {
    setOrigin(point);
  };

  const selectDestination = (point: GeoPoint) => {
    setDestination(point);
  };

  // --- Itineraires enregistres -------------------------------------------

  const saveRoute = (routeOption: RouteOption) => {
    if (!origin || !destination) {
      return;
    }
    const savedRouteRecord = createSavedRouteRecord(user.id, origin, destination, routeOption);
    setSavedRoutes(saveSavedRouteRecord(savedRouteRecord));
    setSavedRouteId(routeOption.id);
    window.setTimeout(() => setSavedRouteId(''), 1800);
  };

  const loadSavedRoute = (entry: SavedRouteRecord) => {
    setOrigin(entry.origin);
    setDestination(entry.destination);
    setSelectedRouteId(entry.routeId);
    setTripsHub((hub) => ({ ...hub, open: false }));
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

  // --- Planification ------------------------------------------------------

  const openHub = (tab: TripsHubTab = 'upcoming') => setTripsHub({ open: true, tab });

  // "Nouveau trajet" depuis le hub : referme le dialog puis met le focus sur la
  // recherche de depart (apres la restitution de focus de Radix).
  const startNewTrip = () => {
    setTripsHub((hub) => ({ ...hub, open: false }));
    window.setTimeout(() => {
      for (const id of ['desktop-origin-search', 'mobile-origin-search']) {
        const input = document.getElementById(id);
        if (input instanceof HTMLInputElement && input.offsetParent !== null) {
          input.focus();
          break;
        }
      }
    }, 320);
  };

  const planRoute = (routeOption: RouteOption) => {
    if (!origin || !destination) {
      return;
    }
    setPlanSource({
      label: routeOption.title,
      origin,
      destination,
      modes: routeOption.modes,
      distanceKm: routeOption.distanceKm,
      durationMinutes: routeOption.durationMinutes,
      carbonGrams: routeOption.carbonGrams,
      carbonSavedGrams: routeOption.carbonSavedGrams,
    });
  };

  const planSavedRoute = (entry: SavedRouteRecord) => {
    setPlanSource({
      label: entry.routeTitle,
      origin: entry.origin,
      destination: entry.destination,
      modes: entry.modes,
      distanceKm: entry.distanceKm,
      durationMinutes: entry.durationMinutes,
      carbonGrams: entry.carbonGrams,
      carbonSavedGrams: entry.carbonSavedGrams,
    });
  };

  const submitPlan = (plan: PlanTripSubmit) => {
    if (!planSource) {
      return;
    }
    const source = { ...planSource, label: plan.label };
    if (plan.kind === 'once' && plan.scheduledFor) {
      setPlannedTrips(savePlannedTrip(createPlannedTrip(user.id, source, plan.scheduledFor)));
      setPlanSource(null);
      openHub('upcoming');
      return;
    }
    if (plan.kind === 'recurring' && plan.daysOfWeek && plan.departureTime) {
      setRecurringTrips(
        saveRecurringTrip(
          createRecurringTrip(user.id, source, {
            daysOfWeek: plan.daysOfWeek,
            departureTime: plan.departureTime,
            returnTime: plan.returnTime ?? null,
          }),
        ),
      );
      setPlannedTrips(syncRecurringOccurrences(user.id));
      setPlanSource(null);
      openHub('recurring');
    }
  };

  const markTripDone = (trip: PlannedTrip) => {
    const updated = setPlannedTripStatus(user.id, trip.id, 'done');
    setPlannedTrips(updated);
    const done = updated.find((item) => item.id === trip.id);
    if (done) {
      onTripCompleted(plannedTripToRecord(done));
    }
  };

  const cancelTrip = (trip: PlannedTrip) => {
    setPlannedTrips(setPlannedTripStatus(user.id, trip.id, 'cancelled'));
  };

  const removeTrip = (trip: PlannedTrip) => {
    setPlannedTrips(deletePlannedTrip(user.id, trip.id));
  };

  const toggleRecurringPaused = (trip: RecurringTrip) => {
    setRecurringTrips(setRecurringTripPaused(user.id, trip.id, !trip.paused));
    if (trip.paused) {
      // Reprise : rematerialiser les occurrences de la fenetre.
      setPlannedTrips(syncRecurringOccurrences(user.id));
    } else {
      // Pause : les occurrences encore a faire disparaissent du plan.
      setPlannedTrips(prunePlannedForRecurring(user.id, trip.id));
    }
  };

  const removeRecurring = (trip: RecurringTrip) => {
    const { recurring, planned } = deleteRecurringTrip(user.id, trip.id);
    setRecurringTrips(recurring);
    setPlannedTrips(planned);
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
              activitySummary={activitySummary}
              upcoming={upcoming}
              onMarkTripDone={markTripDone}
              onOpenHub={openHub}
              onStartTutorial={() => setTutorialSignal((value) => value + 1)}
            />
          </div>
        </aside>

        <section className="relative min-h-0 min-w-0 bg-[var(--shell)]" data-tour="map">
          <div className="absolute inset-y-3 left-3 right-3 z-0 overflow-hidden rounded-2xl bg-muted">
            <UrbanMap
              origin={origin}
              destination={destination}
              routes={routes}
              selectedRoute={selectedRoute}
              network={network}
              layers={layers}
              navigationPoint={navigationPoint}
            />
          </div>

          <div
            className="pointer-events-none absolute inset-y-3 left-3 right-3 z-10 overflow-hidden transition-[left,right] duration-300"
            style={{ boxShadow: '0 0 0 100vmax var(--shell)' }}
          >
            <div className="relative h-full w-full overflow-hidden rounded-2xl">
              <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl shadow-[inset_0_0_24px_3px_rgba(0,0,0,0.22)]" />

              <div className="pointer-events-auto absolute left-0 top-0 z-30 w-[min(720px,calc(100%-3rem))]" data-tour="search">
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

              <div className="pointer-events-auto absolute bottom-0 left-0 z-30 max-w-[calc(100%-0.5rem)]" data-tour="routes">
                <div className="relative">
                  <div className="flex max-w-[calc(100vw-780px)] items-center gap-2 overflow-hidden rounded-tr-2xl bg-[var(--shell)] p-1.5 shadow-[0_0_20px_-2px_rgba(0,0,0,0.28)]">
                    <MapStatusBar routingApiStatus={routingApiStatus} geoStatus={geoStatus} />
                    <DesktopRouteStrip routes={routes} selectedRoute={selectedRoute} onSelect={setSelectedRouteId} />
                  </div>
                  <MergeFillet corner="tr" size={18} className="bottom-0 right-0 translate-x-[calc(100%_-_1px)]" />
                  <MergeFillet corner="tr" size={18} className="left-0 top-0 translate-y-[calc(-100%_+_1px)]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="relative z-20 flex min-h-0 flex-col gap-2 overflow-y-auto bg-[var(--shell)] p-3 pl-0" data-tour="route-detail">
          {coverageWarning ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">{coverageWarning}</p>
          ) : null}
          {selectedRoute ? (
            <RouteDetailPanel
              routeOption={selectedRoute}
              saved={savedRouteId === selectedRoute.id}
              onSave={() => saveRoute(selectedRoute)}
              onPlan={() => planRoute(selectedRoute)}
            />
          ) : null}
          <div data-tour="carbon">
            <CarbonPanel user={user} records={tripRecords} onClear={onTripHistoryClear} summary={carbonSummary} />
          </div>
        </aside>
      </div>

      <div className="relative h-full w-full overflow-hidden bg-muted lg:hidden">
        <div className="absolute inset-0">
          <UrbanMap
            origin={origin}
            destination={destination}
            routes={routes}
            selectedRoute={selectedRoute}
            network={network}
            layers={layers}
            navigationPoint={navigationPoint}
          />
        </div>

        <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-start gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div className="pointer-events-auto relative z-[70] w-full" data-tour="search">
            <MobileSearchShell
              origin={origin}
              destination={destination}
              upcomingCount={activitySummary.upcomingCount}
              currentPosition={currentPosition}
              onOriginSelect={selectOrigin}
              onDestinationSelect={selectDestination}
              onCurrentPositionRequest={requestCurrentPosition}
              onOpenTrips={() => openHub('upcoming')}
              onOpenProfile={() => setProfileOpen(true)}
            />
          </div>
          <div className="pointer-events-auto relative z-40 flex h-8 max-w-full items-center gap-2 rounded-full bg-white/95 px-3 text-xs font-semibold text-foreground shadow-soft backdrop-blur-xl">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{geoStatus}</span>
          </div>
        </header>

        {routeRequested ? (
        <MobileTripPanel
          destination={destination}
          routeRequested={routeRequested}
          routes={routes}
          selectedRoute={selectedRoute}
          savedRouteId={savedRouteId}
          layers={layers}
          routingApiStatus={routingApiStatus}
          enabledModes={enabledModes}
          upcomingCount={activitySummary.upcomingCount}
          coverageWarning={coverageWarning}
          onLayersChange={setLayers}
          onToggleMode={toggleEnabledMode}
          onSelectRoute={setSelectedRouteId}
          onSaveRoute={saveRoute}
          onPlanRoute={planRoute}
          onOpenHub={() => openHub('upcoming')}
        />
        ) : null}
      </div>

      <ProfileDrawer
        user={user}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onSave={onProfileSave}
        onStartTutorial={() => {
          setProfileOpen(false);
          setTutorialSignal((value) => value + 1);
        }}
        onDeleteAccount={() => {
          setProfileOpen(false);
          onAccountDelete();
        }}
        onLogout={() => {
          setProfileOpen(false);
          onLogout();
        }}
      />
      <TripsHubDialog
        open={tripsHub.open}
        initialTab={tripsHub.tab}
        user={user}
        plannedTrips={plannedTrips}
        recurringTrips={recurringTrips}
        savedRoutes={savedRoutes}
        summary={activitySummary}
        onOpenChange={(open) => setTripsHub((hub) => ({ ...hub, open }))}
        onProfileSave={onProfileSave}
        onNewTrip={startNewTrip}
        onMarkDone={markTripDone}
        onCancelTrip={cancelTrip}
        onDeleteTrip={removeTrip}
        onToggleRecurringPaused={toggleRecurringPaused}
        onDeleteRecurring={removeRecurring}
        onLoadSavedRoute={loadSavedRoute}
        onPlanSavedRoute={planSavedRoute}
        onDeleteSavedRoute={deleteSavedRoute}
      />
      <PlanTripDialog source={planSource} onOpenChange={(open) => (!open ? setPlanSource(null) : undefined)} onSubmit={submitPlan} />
      <TutorialOverlay relaunchSignal={tutorialSignal} />
    </main>
  );
}
