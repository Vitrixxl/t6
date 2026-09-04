// Orchestrateur principal : recherche d'itineraires, comparaison des options et
// carte. Il ne tient que l'etat de l'ecran (depart, arrivee, calques, panneaux
// ouverts) : l'etat du compte vit dans le cache de requetes (src/queries/),
// que chaque module lit.
import { useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import type { GeoPoint, RouteOption, SavedRouteRecord, TransportNetwork } from '../../types';
import { haversineDistanceKm } from '../../lib/planner';
import { useGeolocation } from './hooks/useGeolocation';
import { useRouteOptions } from './hooks/useRouteOptions';
import { useDesktopLayout } from './hooks/useDesktopLayout';
import { CITY_CENTER, METRO_RADIUS_KM, describePoint } from '../../lib/transport';
import { useProfile, useSaveError, useSaveRoute } from '../../queries';
import { closeHubAtom, planSourceAtom } from '../../state';
import { UrbanMap, DEFAULT_LAYERS, MergeFillet, type LayerState } from './shared';
import { ShellSidebar } from '../layout/Shell';
import { CommandSearchBar, MobileSearchShell } from '../planner/SearchPanels';
import { DesktopRouteStrip, MapStatusBar, RouteDetailPanel } from '../planner/RoutePanels';
import { MobileTripPanel } from '../planner/MobilePanels';
import { MobileActionRail } from '../planner/MobileQuickPanels';
import { PlanTripDialog, TripsHubDialog } from '../planner/trips';
import { CarbonPanel } from '../carbon/CarbonPanel';
import { ProfileDrawer } from '../profile/ProfilePanels';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';

/** Duree du retour visuel "enregistre" sur le bouton. */
const SAVE_CONFIRMATION_MS = 1800;

export function MobilityMapApp({ network }: { network: TransportNetwork }) {
    const profile = useProfile();
    const saveError = useSaveError();
    const persistRoute = useSaveRoute();
    const startPlanning = useSetAtom(planSourceAtom);
    const closeHub = useSetAtom(closeHubAtom);

    // Le depart choisi explicitement. Tant qu'il est vide, c'est la position
    // courante qui fait office de depart : ouvrir l'application et saisir une
    // destination doit suffire, sans avoir a designer un depart evident.
    const [chosenOrigin, setChosenOrigin] = useState<GeoPoint | null>(null);
    const [destination, setDestination] = useState<GeoPoint | null>(null);
    const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
    const [leftRailOpen, setLeftRailOpen] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);
    const [justSavedRouteId, setJustSavedRouteId] = useState('');
    const [tutorialSignal, setTutorialSignal] = useState(0);
    // Une seule disposition est rendue a la fois : une seule carte en memoire.
    const desktop = useDesktopLayout();

    const { currentPosition, status: geoStatus, requestCurrentPosition } = useGeolocation();
    const origin = chosenOrigin ?? currentPosition;
    const setOrigin = setChosenOrigin;

    // La position est demandee des l'ouverture. Le navigateur pose lui-meme la
    // question du consentement : c'est cette invite qui vaut accord, et un refus
    // laisse simplement la saisie manuelle (C6/C8).
    useEffect(() => {
        void requestCurrentPosition();
        // Une seule fois par montage : redemander en boucle harcelerait
        // l'utilisateur qui a refuse.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const { routes, selectedRoute, setSelectedRouteId, routingStatus } = useRouteOptions({
        origin,
        destination,
        profile,
        network,
    });

    const routeRequested = Boolean(origin && destination);
    const navigationPoint = currentPosition ? { ...currentPosition, label: 'Ma position' } : null;

    // Demander sa position sert autant a la definir comme depart qu'a la voir :
    // sans recentrage, le repere pouvait apparaitre hors du cadre visible.
    const [mapFocus, setMapFocus] = useState<{ point: GeoPoint; at: number } | null>(null);
    const locateAndFocus = () =>
        void requestCurrentPosition().then((point) => {
            if (!point) {
                return;
            }
            setOrigin(point);
            setMapFocus({ point, at: Date.now() });
        });

    // Perimetre produit: la recherche est bornee a la metropole, mais la position
    // GPS peut en sortir. On previent honnetement que l'offre y est reduite.
    const outsideMetro = [origin, destination].some(
        (point) => point && haversineDistanceKm(point, CITY_CENTER) > METRO_RADIUS_KM + 4,
    );
    const coverageWarning = routeRequested && outsideMetro
        ? 'Hors metropole de Lyon : transport public et velos/trottinettes indisponibles, seule la marche reste proposee.'
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

    // Le depart bascule sur la position courante quand il n'a jamais ete saisi :
    // inverser un trajet dont un bout est implicite doit rester possible.
    const swapEndpoints = () => {
        const start = origin ?? currentPosition;
        setOrigin(destination);
        setDestination(start);
    };

    const saveRoute = (routeOption: RouteOption) => {
        if (!origin || !destination) {
            return;
        }
        persistRoute({ option: routeOption, origin, destination });
        setJustSavedRouteId(routeOption.id);
        window.setTimeout(() => setJustSavedRouteId(''), SAVE_CONFIRMATION_MS);
    };

    // Fermer l'itineraire remet l'ecran a son etat de depart : la feuille
    // d'options cede la place a la barre d'actions, et la barre de recherche
    // repasse a son unique champ. Les requetes en vol s'annulent d'elles-memes,
    // leurs effets dependant du couple depart / arrivee.
    const closeItinerary = () => {
        setChosenOrigin(null);
        setDestination(null);
        setSelectedRouteId('');
    };

    const loadSavedRoute = (entry: SavedRouteRecord) => {
        setOrigin(entry.origin);
        setDestination(entry.destination);
        setSelectedRouteId(entry.routeId);
        closeHub();
    };

    // "Nouveau trajet" depuis le hub : referme le dialog puis met le focus sur la
    // recherche de depart (apres la restitution de focus de Radix).
    const startNewTrip = () => {
        closeHub();
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

    // Une ecriture refusee par le serveur se dit, elle ne se masque pas : ce
    // que le serveur tient reprend l'ecran, et l'action est a rejouer.
    const saveErrorBanner = saveError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-800">
            Action refusee par le serveur : {saveError}
        </p>
    ) : null;

    return (
        <main className="relative h-dvh w-screen overflow-hidden bg-[var(--shell)] text-foreground">
            {desktop ? (
                <div className="grid h-full w-full grid-cols-[var(--left-rail)_minmax(0,1fr)_390px]" style={{ ['--left-rail' as string]: leftRailOpen ? '360px' : '0px' }}>
                    <aside className="relative z-20 min-w-0 overflow-hidden bg-[var(--shell)] transition-[width] duration-300">
                        <div className="h-full w-[360px]">
                            <ShellSidebar
                                layers={layers}
                                onLayersChange={setLayers}
                                network={network}
                                onOpenProfile={() => setProfileOpen(true)}
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
                                focus={mapFocus}
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
                        {saveErrorBanner}
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
                            <CarbonPanel />
                        </div>
                    </aside>
                </div>
            ) : (
                <div className="relative h-full w-full overflow-hidden bg-muted">
                    <div className="absolute inset-0">
                        <UrbanMap
                            origin={origin}
                            destination={destination}
                            routes={routes}
                            selectedRoute={selectedRoute}
                            network={network}
                            layers={layers}
                            navigationPoint={navigationPoint}
                            focus={mapFocus}
                            onPickPoint={pickPointFromMap}
                        />
                    </div>

                    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-start gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
                        <div className="pointer-events-auto relative z-[70] w-full" data-tour="search">
                            <MobileSearchShell
                                origin={origin}
                                destination={destination}
                                currentPosition={currentPosition}
                                onOriginSelect={selectOrigin}
                                onDestinationSelect={selectDestination}
                                onSwap={swapEndpoints}
                                onCurrentPositionRequest={requestCurrentPosition}
                            />
                        </div>
                        {saveErrorBanner ? <div className="pointer-events-auto w-full">{saveErrorBanner}</div> : null}
                    </header>

                    {/* La barre reste en place tant qu'aucun itineraire n'est demande. La
            feuille d'options la recouvre ensuite : ses actions restent
            atteignables en la repliant. */}
                    {!routeRequested ? (
                        <MobileActionRail
                            network={network}
                            currentPosition={currentPosition}
                            origin={origin}
                            layers={layers}
                            onLayersChange={setLayers}
                            onOpenProfile={() => setProfileOpen(true)}
                            onLocate={locateAndFocus}
                        />
                    ) : null}

                    {routeRequested ? (
                        <MobileTripPanel
                            destination={destination}
                            routes={routes}
                            selectedRoute={selectedRoute}
                            savedRouteId={justSavedRouteId}
                            routingStatus={routingStatus}
                            coverageWarning={coverageWarning}
                            onSelectRoute={setSelectedRouteId}
                            onSaveRoute={saveRoute}
                            onPlanRoute={planRoute}
                            onOpenProfile={() => setProfileOpen(true)}
                            onClose={closeItinerary}
                        />
                    ) : null}
                </div>
            )}

            <ProfileDrawer
                open={profileOpen}
                onOpenChange={setProfileOpen}
                onStartTutorial={() => {
                    setProfileOpen(false);
                    setTutorialSignal((value) => value + 1);
                }}
            />
            <TripsHubDialog onNewTrip={startNewTrip} onLoadSavedRoute={loadSavedRoute} />
            <PlanTripDialog />
            <TutorialOverlay relaunchSignal={tutorialSignal} />
        </main>
    );
}
