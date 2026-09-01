// Orchestrateur principal : recherche d'itineraires, comparaison des options et
// planification des trajets (dates, recurrents, objectifs). Auth geree par App.
import { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import type { GeoPoint, MobilityProfile, RouteOption, SavedRouteRecord, SessionUser, TransportNetwork, TripRecord } from '../../types';
import { haversineDistanceKm } from '../../lib/planner';
import { useGeolocation } from './hooks/useGeolocation';
import { useSavedRoutes } from './hooks/useSavedRoutes';
import { useTripPlanning } from './hooks/useTripPlanning';
import { useRouteOptions } from './hooks/useRouteOptions';
import { CITY_CENTER, METRO_RADIUS_KM, describePoint } from '../../lib/transport';
import { summarizeCarbon } from '../../lib/carbon';
import { summarizeTripActivity, upcomingTrips } from '../../lib/trips';
import { UrbanMap, DEFAULT_LAYERS, MergeFillet, type LayerState } from './shared';
import { ShellSidebar } from '../layout/Shell';
import { CommandSearchBar, MobileSearchShell } from '../planner/SearchPanels';
import { DesktopRouteStrip, MapStatusBar, RouteDetailPanel } from '../planner/RoutePanels';
import { MobileTripPanel } from '../planner/MobilePanels';
import { MobileActionRail } from '../planner/MobileQuickPanels';
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
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [leftRailOpen, setLeftRailOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const { savedRoutes, justSavedRouteId, saveRoute: persistRoute, deleteSavedRoute } = useSavedRoutes(user.id);

  // Planification : occurrences datees + routines recurrentes.
  const [tripsHub, setTripsHub] = useState<{ open: boolean; tab: TripsHubTab }>({ open: false, tab: 'upcoming' });
  const [tutorialSignal, setTutorialSignal] = useState(0);

  const {
    plannedTrips,
    recurringTrips,
    planSource,
    startPlanning,
    cancelPlanning,
    submitPlan: submitTripPlan,
    markTripDone,
    cancelTrip,
    removeTrip,
    toggleRecurringPaused,
    removeRecurring,
  } = useTripPlanning(user.id, onTripCompleted);

  const { currentPosition, status: geoStatus, requestCurrentPosition } = useGeolocation();
  const { routes, selectedRoute, selectedLegs, setSelectedRouteId, routingStatus } = useRouteOptions({
    origin,
    destination,
    profile: user.profile,
    network,
  });


  const routeRequested = Boolean(origin && destination);

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

  // Appui long sur la carte : le point est nomme par geocodage inverse avant
  // d'atterrir dans le champ, sinon l'utilisateur y verrait des coordonnees.
  const pickPointFromMap = (picked: { lat: number; lon: number }, role: 'origin' | 'destination') => {
    void describePoint(picked.lat, picked.lon).then((point) => {
      if (role === 'origin') {
        setOrigin(point);
      } else {
        setDestination(point);
      }
    });
  };

  const selectOrigin = (point: GeoPoint) => {
    setOrigin(point);
  };

  const selectDestination = (point: GeoPoint) => {
    setDestination(point);
  };

  const saveRoute = (routeOption: RouteOption) => {
    if (origin && destination) {
      persistRoute(routeOption, origin, destination);
    }
  };

  const loadSavedRoute = (entry: SavedRouteRecord) => {
    setOrigin(entry.origin);
    setDestination(entry.destination);
    setSelectedRouteId(entry.routeId);
    setTripsHub((hub) => ({ ...hub, open: false }));
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
    startPlanning({
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
    startPlanning({
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

  // La planification decide de l'onglet a ouvrir ; l'interface se contente de
  // suivre ce que le domaine a conclu.
  const submitPlan = (plan: PlanTripSubmit) => {
    const tab = submitTripPlan(plan);
    if (tab) {
      openHub(tab);
    }
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
              selectedLegs={selectedLegs}
              network={network}
              layers={layers}
              navigationPoint={navigationPoint}
          onPickPoint={pickPointFromMap}
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
                    <MapStatusBar routingStatus={routingStatus} geoStatus={geoStatus} />
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
              saved={justSavedRouteId === selectedRoute.id}
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
            selectedLegs={selectedLegs}
            network={network}
            layers={layers}
            navigationPoint={navigationPoint}
          onPickPoint={pickPointFromMap}
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

        {/* La barre laisse la place a la feuille d'options des qu'un itineraire
            est demande : les couches restent accessibles depuis la feuille, et
            le GPS depuis la barre de recherche. */}
        {!routeRequested ? (
        <MobileActionRail
          network={network}
          currentPosition={currentPosition}
          origin={origin}
          upcomingTrip={upcoming[0] ?? null}
          carbonSummary={carbonSummary}
          weeklyGoalGrams={user.profile.carbonGoalGramsPerWeek}
          layers={layers}
          routingStatus={routingStatus}
          onLayersChange={setLayers}
          onOpenHub={() => openHub('upcoming')}
          onLocate={() => void requestCurrentPosition().then((point) => point && setOrigin(point))}
        />
        ) : null}

        {routeRequested ? (
        <MobileTripPanel
          destination={destination}
          routes={routes}
          selectedRoute={selectedRoute}
          savedRouteId={justSavedRouteId}
          layers={layers}
          routingStatus={routingStatus}
          upcomingCount={activitySummary.upcomingCount}
          coverageWarning={coverageWarning}
          onLayersChange={setLayers}
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
      <PlanTripDialog source={planSource} onOpenChange={(open) => (!open ? cancelPlanning() : undefined)} onSubmit={submitPlan} />
      <TutorialOverlay relaunchSignal={tutorialSignal} />
    </main>
  );
}
