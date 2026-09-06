// Orchestrateur principal : recherche d'itinéraire, trajet retenu et carte. Il ne tient que l'état de l'écran (départ, arrivée, calques, panneaux
// ouverts) : l'état du compte vit dans le cache de requêtes (src/queries/),
// que chaque module lit.
import { useCallback, useEffect, useState } from 'react';
import { useSetAtom } from 'jotai';
import type { GeoPoint, RouteOption, SavedRouteRecord, TransportContext } from '../../types';
import { ALL_TRANSIT_TYPES, availableModesOf, haversineDistanceKm } from '../../lib/planner';
import { useGeolocation } from './hooks/useGeolocation';
import { useRouteOptions } from './hooks/useRouteOptions';
import { useDesktopLayout } from './hooks/useDesktopLayout';
import { CITY_CENTER, METRO_RADIUS_KM, describePoint } from '../../lib/transport';
import { useProfile, useSaveError, useSaveRoute } from '../../queries';
import { closeHubAtom, planSourceAtom, searchFiltersAtom } from '../../state';
import { DEFAULT_LAYERS, type LayerState } from './shared';
import { PlanTripDialog, TripsHubDialog } from '../planner/trips';
import { ProfileDrawer } from '../profile/ProfilePanels';
import { OnboardingDialog } from '../profile/OnboardingDialog';
import { TutorialOverlay } from '../tutorial/TutorialOverlay';
import { DesktopMobilityLayout, MobileMobilityLayout, type TripMapState } from './MobilityLayouts';

/** Durée du retour visuel "enregistre" sur le bouton. */
const SAVE_CONFIRMATION_MS = 1800;

export function MobilityMapApp({ network }: { network: TransportContext }) {
    const profile = useProfile();
    const saveError = useSaveError();
    const persistRoute = useSaveRoute();
    const startPlanning = useSetAtom(planSourceAtom);
    const closeHub = useSetAtom(closeHubAtom);
    const setSearchFilters = useSetAtom(searchFiltersAtom);

    // Le départ choisi explicitement. Tant qu'il est vide, c'est la position
    // courante qui fait office de départ : ouvrir l'application et saisir une
    // destination doit suffire, sans avoir a désigner un départ évident.
    const [chosenOrigin, setChosenOrigin] = useState<GeoPoint | null>(null);
    const [destination, setDestination] = useState<GeoPoint | null>(null);
    const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
    const [leftRailOpen, setLeftRailOpen] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);
    const [justSavedRouteId, setJustSavedRouteId] = useState('');
    const [tutorialSignal, setTutorialSignal] = useState(0);
    // Une seule disposition est rendue à la fois : une seule carte en mémoire.
    const desktop = useDesktopLayout();

    const { currentPosition, status: geoStatus, requestCurrentPosition } = useGeolocation();
    const origin = chosenOrigin ?? currentPosition;
    const setOrigin = setChosenOrigin;

    // La position est demandée dès l'ouverture. Le navigateur pose lui-même la
    // question du consentement : c'est cette invite qui vaut accord, et un refus
    // laisse simplement la saisie manuelle (C6/C8).
    useEffect(() => {
        void requestCurrentPosition();
        // Une seule fois par montage : redemander en boucle harcelerait
        // l'utilisateur qui a refusé.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const { route, options, queryKey, routingStatus } = useRouteOptions({
        origin,
        destination,
        profile,
        network,
    });

    const routeRequested = Boolean(origin && destination);
    const navigationPoint = currentPosition ? { ...currentPosition, label: 'Ma position' } : null;

    // Demander sa position sert autant à la définir comme départ qu'à la voir :
    // sans recentrage, le repere pouvait apparaître hors du cadre visible.
    const [mapFocus, setMapFocus] = useState<{ point: GeoPoint; at: number } | null>(null);
    const locateAndFocus = () =>
        void requestCurrentPosition().then((point) => {
            if (!point) {
                return;
            }
            setOrigin(point);
            setMapFocus({ point, at: Date.now() });
        });

    // Périmètre produit: la recherche est bornée à la métropole, mais la position
    // GPS peut en sortir. On prévient honnêtement que l'offre y est réduite.
    const outsideMetro = [origin, destination].some(
        (point) => point && haversineDistanceKm(point, CITY_CENTER) > METRO_RADIUS_KM + 4,
    );
    const coverageWarning = routeRequested && outsideMetro
        ? 'Hors métropole de Lyon : transport public et vélos/trottinettes indisponibles, seule la marche reste proposée.'
        : null;

    // Appui long sur la carte : le point est nommé par géocodage inverse avant
    // d'atterrir dans le champ, sinon l'utilisateur y verrait des coordonnées.
    // Une position GPS ou un flux rafraîchi ne doit pas détacher le sélecteur ouvert.
    const pickPointFromMap = useCallback((picked: { lat: number; lon: number }, role: 'origin' | 'destination') => {
        void describePoint(picked.lat, picked.lon).then((point) => {
            if (role === 'origin') {
                setOrigin(point);
            } else {
                setDestination(point);
            }
        });
    }, [setOrigin, setDestination]);

    // Le départ bascule sur la position courante quand il n'a jamais été saisi :
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

    // Fermer l'itinéraire remet l'écran à son état de départ : la feuille du
    // trajet cède la place à la barre d'actions, la barre de recherche repasse
    // à son unique champ et les filtres reviennent au profil. Les requêtes en
    // vol s'annulent d'elles-mêmes, leurs effets dépendant du couple départ / arrivée.
    const closeItinerary = () => {
        setChosenOrigin(null);
        setDestination(null);
        setSearchFilters(null);
    };

    // Un trajet enregistré se recalcule avec les moyens qu'il empruntait : le
    // recharger avec d'autres moyens donnerait un autre trajet.
    const loadSavedRoute = (entry: SavedRouteRecord) => {
        setOrigin(entry.origin);
        setDestination(entry.destination);
        setSearchFilters({ modes: availableModesOf(entry.modes), transitTypes: ALL_TRANSIT_TYPES });
        closeHub();
    };

    // "Nouveau trajet" depuis le hub : referme le dialog puis met le focus sur la
    // recherche de départ (après la restitution de focus de Radix).
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

    const map: TripMapState = {
        origin,
        destination,
        route,
        options,
        queryKey,
        network,
        layers,
        navigationPoint,
        focus: mapFocus,
        onPickPoint: pickPointFromMap,
    };

    return (
        <main className="relative h-full w-full overflow-hidden bg-[var(--shell)] text-foreground">
            {desktop ? (
                <DesktopMobilityLayout
                    map={map}
                    leftRailOpen={leftRailOpen}
                    routeRequested={routeRequested}
                    routingStatus={routingStatus}
                    geoStatus={geoStatus}
                    saveError={saveError}
                    coverageWarning={coverageWarning}
                    savedRouteId={justSavedRouteId}
                    currentPosition={currentPosition}
                    onLayersChange={setLayers}
                    onToggleLeftRail={() => setLeftRailOpen((current) => !current)}
                    onOpenProfile={() => setProfileOpen(true)}
                    onStartTutorial={() => setTutorialSignal((value) => value + 1)}
                    onCurrentPositionRequest={requestCurrentPosition}
                    onOriginSelect={setOrigin}
                    onDestinationSelect={setDestination}
                    onSaveRoute={saveRoute}
                    onPlanRoute={planRoute}
                />
            ) : (
                <MobileMobilityLayout
                    map={map}
                    routeRequested={routeRequested}
                    routingStatus={routingStatus}
                    saveError={saveError}
                    coverageWarning={coverageWarning}
                    savedRouteId={justSavedRouteId}
                    currentPosition={currentPosition}
                    onLayersChange={setLayers}
                    onOpenProfile={() => setProfileOpen(true)}
                    onLocate={locateAndFocus}
                    onCurrentPositionRequest={requestCurrentPosition}
                    onOriginSelect={setOrigin}
                    onDestinationSelect={setDestination}
                    onSwap={swapEndpoints}
                    onSaveRoute={saveRoute}
                    onPlanRoute={planRoute}
                    onCloseRoute={closeItinerary}
                />
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
            <OnboardingDialog />
            {/* Le tour guidé attend que les questions d'accueil soient posées. */}
            <TutorialOverlay desktop={desktop} ready={profile.onboardedAt !== null} relaunchSignal={tutorialSignal} />
        </main>
    );
}
