// Dispositions de l'écran principal. L'orchestrateur fournit l'état et les
// actions ; ce module décide uniquement où afficher chaque bloc.
import type { Dispatch, SetStateAction } from 'react';
import type { GeoPoint, RouteOption, TransportContext } from '../../types';
import { CarbonPanel } from '../carbon/CarbonPanel';
import { ShellSidebar } from '../layout/Shell';
import { MobileActionRail } from '../planner/MobileQuickPanels';
import { SearchFilters } from '../planner/SearchFilters';
import { RouteChoices } from '../planner/RouteChoices';
import { MobileTripPanel, NO_ROUTE_MESSAGE } from '../planner/MobilePanels';
import { MapStatusBar, RouteDetailPanel } from '../planner/RoutePanels';
import { CommandSearchBar, MobileSearchShell } from '../planner/SearchPanels';
import { MergeFillet, UrbanMap, type LayerState } from './shared';
import type { RoutingStatus } from './hooks/useRouteOptions';
import type { PickedPoint } from '../map/longPress';

export interface TripMapState {
    origin: GeoPoint | null;
    destination: GeoPoint | null;
    route: RouteOption | null;
    options: RouteOption[];
    queryKey: string;
    network: TransportContext;
    layers: LayerState;
    navigationPoint: GeoPoint | null;
    focus: { point: GeoPoint; at: number } | null;
    onPickPoint: (point: PickedPoint, role: 'origin' | 'destination') => void;
}

function TripMap({ state }: { state: TripMapState }) {
    return (
        <UrbanMap
            origin={state.origin}
            destination={state.destination}
            route={state.route}
            network={state.network}
            layers={state.layers}
            navigationPoint={state.navigationPoint}
            focus={state.focus}
            onPickPoint={state.onPickPoint}
        />
    );
}

function SaveErrorBanner({ message }: { message: string | null }) {
    if (!message) {
        return null;
    }
    return (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-800">
            Action refusée par le serveur : {message}
        </p>
    );
}

function CoverageWarning({ message }: { message: string | null }) {
    if (!message) {
        return null;
    }
    return <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">{message}</p>;
}

interface DesktopMobilityLayoutProps {
    map: TripMapState;
    leftRailOpen: boolean;
    routeRequested: boolean;
    routingStatus: RoutingStatus;
    geoStatus: string;
    saveError: string | null;
    coverageWarning: string | null;
    savedRouteId: string;
    currentPosition: GeoPoint | null;
    onLayersChange: Dispatch<SetStateAction<LayerState>>;
    onToggleLeftRail: () => void;
    onOpenProfile: () => void;
    onStartTutorial: () => void;
    onCurrentPositionRequest: () => Promise<GeoPoint | null>;
    onOriginSelect: (point: GeoPoint) => void;
    onDestinationSelect: (point: GeoPoint) => void;
    onSaveRoute: (route: RouteOption) => void;
    onPlanRoute: (route: RouteOption) => void;
}

export function DesktopMobilityLayout(props: DesktopMobilityLayoutProps) {
    const { map } = props;
    const route = map.route;

    return (
        <div
            className="grid h-full w-full grid-cols-[var(--left-rail)_minmax(0,1fr)_390px]"
            style={{ ['--left-rail' as string]: props.leftRailOpen ? '360px' : '0px' }}
        >
            <aside className="relative z-20 min-w-0 overflow-hidden bg-[var(--shell)] transition-[width] duration-300">
                <div className="h-full w-[360px]">
                    <ShellSidebar
                        layers={map.layers}
                        onLayersChange={props.onLayersChange}
                        network={map.network}
                        onOpenProfile={props.onOpenProfile}
                        onStartTutorial={props.onStartTutorial}
                    />
                </div>
            </aside>

            <section className="relative min-h-0 min-w-0 bg-[var(--shell)]" data-tour="map">
                <div className="absolute inset-y-3 left-3 right-3 z-0 overflow-hidden rounded-2xl bg-muted">
                    <TripMap state={map} />
                </div>

                <div
                    className="pointer-events-none absolute inset-y-3 left-3 right-3 z-10 overflow-hidden transition-[left,right] duration-300"
                    style={{ boxShadow: '0 0 0 100vmax var(--shell)' }}
                >
                    <div className="relative h-full w-full overflow-hidden rounded-2xl">
                        <div className="pointer-events-none absolute inset-0 z-20 rounded-2xl shadow-[inset_0_0_24px_3px_rgba(0,0,0,0.22)]" />

                        <div className="pointer-events-auto absolute left-0 top-0 z-30 w-[min(720px,calc(100%-3rem))]" data-tour="search">
                            <CommandSearchBar
                                leftRailOpen={props.leftRailOpen}
                                onToggleLeftRail={props.onToggleLeftRail}
                                origin={map.origin}
                                destination={map.destination}
                                currentPosition={props.currentPosition}
                                onCurrentPositionRequest={props.onCurrentPositionRequest}
                                onOriginSelect={props.onOriginSelect}
                                onDestinationSelect={props.onDestinationSelect}
                            />
                            <MergeFillet corner="br" className="right-0 top-0 translate-x-[calc(100%_-_1px)]" />
                            <MergeFillet corner="br" className="bottom-0 left-0 translate-y-[calc(100%_-_1px)]" />
                        </div>

                        <div className="pointer-events-auto absolute bottom-0 left-0 z-30 max-w-[calc(100%-0.5rem)]">
                            <div className="relative">
                                <div className="flex items-center gap-2 overflow-hidden rounded-tr-2xl bg-[var(--shell)] p-1.5 shadow-[0_0_20px_-2px_rgba(0,0,0,0.28)]">
                                    <MapStatusBar routingStatus={props.routingStatus} geoStatus={props.geoStatus} />
                                </div>
                                <MergeFillet corner="tr" size={18} className="bottom-0 right-0 translate-x-[calc(100%_-_1px)]" />
                                <MergeFillet corner="tr" size={18} className="left-0 top-0 translate-y-[calc(-100%_+_1px)]" />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <aside className="relative z-20 flex min-h-0 flex-col gap-2 overflow-y-auto bg-[var(--shell)] p-3 pl-0" data-tour="route-detail">
                <SaveErrorBanner message={props.saveError} />
                <CoverageWarning message={props.coverageWarning} />
                {props.routeRequested ? <SearchFilters /> : null}
                {props.routingStatus === 'unavailable' ? <p role="status" className="p-3 text-sm">{NO_ROUTE_MESSAGE}</p> : null}
                <RouteChoices options={map.options} queryKey={map.queryKey} />
                {route ? (
                    <RouteDetailPanel
                        routeOption={route}
                        saved={props.savedRouteId === route.id}
                        onSave={() => props.onSaveRoute(route)}
                        onPlan={() => props.onPlanRoute(route)}
                    />
                ) : null}
                <div data-tour="carbon">
                    <CarbonPanel />
                </div>
            </aside>
        </div>
    );
}

interface MobileMobilityLayoutProps {
    map: TripMapState;
    routeRequested: boolean;
    routingStatus: RoutingStatus;
    saveError: string | null;
    coverageWarning: string | null;
    savedRouteId: string;
    currentPosition: GeoPoint | null;
    onLayersChange: Dispatch<SetStateAction<LayerState>>;
    onOpenProfile: () => void;
    onLocate: () => void;
    onCurrentPositionRequest: () => Promise<GeoPoint | null>;
    onOriginSelect: (point: GeoPoint) => void;
    onDestinationSelect: (point: GeoPoint) => void;
    onSwap: () => void;
    onSaveRoute: (route: RouteOption) => void;
    onPlanRoute: (route: RouteOption) => void;
    onCloseRoute: () => void;
}

export function MobileMobilityLayout(props: MobileMobilityLayoutProps) {
    const { map } = props;

    return (
        <div className="relative h-full w-full overflow-hidden bg-muted" data-tour="mobile-map">
            <div className="absolute inset-0">
                <TripMap state={map} />
            </div>

            <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex flex-col items-start gap-2 px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
                <div className="pointer-events-auto relative z-[70] w-full" data-tour="mobile-search">
                    <MobileSearchShell
                        origin={map.origin}
                        destination={map.destination}
                        currentPosition={props.currentPosition}
                        onOriginSelect={props.onOriginSelect}
                        onDestinationSelect={props.onDestinationSelect}
                        onSwap={props.onSwap}
                        onCurrentPositionRequest={props.onCurrentPositionRequest}
                    />
                </div>
                {props.saveError ? (
                    <div className="pointer-events-auto w-full">
                        <SaveErrorBanner message={props.saveError} />
                    </div>
                ) : null}
            </header>

            {!props.routeRequested ? (
                <MobileActionRail
                    network={map.network}
                    currentPosition={props.currentPosition}
                    origin={map.origin}
                    layers={map.layers}
                    onLayersChange={props.onLayersChange}
                    onOpenProfile={props.onOpenProfile}
                    onLocate={props.onLocate}
                />
            ) : null}

            {props.routeRequested ? (
                <MobileTripPanel
                    destination={map.destination}
                    route={map.route}
                    options={map.options}
                    queryKey={map.queryKey}
                    savedRouteId={props.savedRouteId}
                    routingStatus={props.routingStatus}
                    coverageWarning={props.coverageWarning}
                    onSaveRoute={props.onSaveRoute}
                    onPlanRoute={props.onPlanRoute}
                    onOpenProfile={props.onOpenProfile}
                    onClose={props.onCloseRoute}
                />
            ) : null}
        </div>
    );
}
