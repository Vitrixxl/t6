// Module planification - restitution mobile : feuille d'options, composeur de
// modes et actions de planification.
import { useSetAtom } from 'jotai';
import { CalendarClock, CalendarPlus, Check, Route, UserRound, X } from 'lucide-react';
import { useActivitySummary } from '../../queries';
import { openHubAtom } from '../../state';
import { Button } from '../ui/button';
import type { GeoPoint, RouteOption } from '../../types';
import { getRouteColor } from '../../lib/routeColors';
import { formatCarbonComparisonCompact } from '../../lib/carbon-comparison';
import { ROUTING_STATUS_LABEL, type RoutingStatus } from '../app/hooks/useRouteOptions';
import { Metric, MODE_ICON } from '../app/shared';
import { RouteSteps } from './RouteSteps';
import { useMobileSheet } from './useMobileSheet';

export function MobileTripPanel({
    destination,
    routes,
    selectedRoute,
    savedRouteId,
    routingStatus,
    coverageWarning,
    onSelectRoute,
    onSaveRoute,
    onPlanRoute,
    onOpenProfile,
    onClose }: {
        destination: GeoPoint | null;
        routes: RouteOption[];
        selectedRoute: RouteOption | null;
        savedRouteId: string;
        routingStatus: RoutingStatus;
        coverageWarning: string | null;
        onSelectRoute: (id: string) => void;
        onSaveRoute: (routeOption: RouteOption) => void;
        onPlanRoute: (routeOption: RouteOption) => void;
        onOpenProfile: () => void;
        onClose: () => void;
    }) {
    const sheet = useMobileSheet();

    return (
        <section
            className={`absolute inset-x-0 bottom-0 z-30 overflow-hidden rounded-t-[1.6rem] border border-white/80 bg-white/96 pb-[env(safe-area-inset-bottom)] shadow-float backdrop-blur-xl transition-[max-height] duration-300 ease-in-out ${sheet.sizing.shell}`}
            data-tour="routes"
        >
            <div className="flex h-7 items-center justify-center">
                <button
                    type="button"
                    className="flex h-7 w-24 touch-none cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
                    aria-label="Monter ou baisser le panneau trajets"
                    data-testid="mobile-trip-sheet-handle"
                    {...sheet.handle}
                >
                    <span className="h-1.5 w-12 rounded-full bg-muted-foreground/25" aria-hidden="true" />
                </button>
            </div>
            <div className={`${sheet.sizing.content} overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
                <MobileTripHeader
                    destination={destination}
                    routingStatus={routingStatus}
                    onOpenProfile={onOpenProfile}
                    onClose={onClose}
                />

                {coverageWarning ? (
                    <div className="px-4 pb-3">
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">{coverageWarning}</p>
                    </div>
                ) : null}

                <MobileRouteChoices routes={routes} selectedRoute={selectedRoute} onSelectRoute={onSelectRoute} />
                <MobileRouteSelection
                    routeOption={selectedRoute}
                    savedRouteId={savedRouteId}
                    onSaveRoute={onSaveRoute}
                    onPlanRoute={onPlanRoute}
                />
            </div>
        </section>
    );
}

function MobileTripHeader({
    destination,
    routingStatus,
    onOpenProfile,
    onClose,
}: {
    destination: GeoPoint | null;
    routingStatus: RoutingStatus;
    onOpenProfile: () => void;
    onClose: () => void;
}) {
    const upcomingCount = useActivitySummary().upcomingCount;
    const openHub = useSetAtom(openHubAtom);

    return (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Options d'itinéraire</p>
                <h1 className="truncate text-lg font-semibold tracking-normal">{destination?.label ?? 'Où vas-tu ?'}</h1>
                <p className={`truncate text-[11px] font-medium ${routingStatus === 'unavailable' ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {ROUTING_STATUS_LABEL[routingStatus]}
                </p>
            </div>
            {/* La feuille recouvre la barre d'actions du bas : ces boutons gardent
                le profil et les trajets accessibles pendant la consultation. */}
            <div className="flex shrink-0 items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => openHub('upcoming')}
                    aria-label="Mes trajets"
                    data-tour="mobile-trips"
                    className="relative size-[44px] rounded-xl bg-white p-0"
                >
                    <CalendarClock className="size-5" aria-hidden="true" />
                    {upcomingCount > 0 ? (
                        <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                            {Math.min(upcomingCount, 9)}
                        </span>
                    ) : null}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onOpenProfile}
                    aria-label="Ouvrir le profil"
                    data-tour="mobile-profile"
                    className="size-[44px] rounded-xl bg-white p-0"
                >
                    <UserRound className="size-5" aria-hidden="true" />
                </Button>
                <Button type="button" variant="outline" onClick={onClose} aria-label="Fermer l'itinéraire" className="size-[44px] rounded-xl bg-white p-0">
                    <X className="size-5" aria-hidden="true" />
                </Button>
            </div>
        </div>
    );
}

function MobileRouteChoices({
    routes,
    selectedRoute,
    onSelectRoute,
}: {
    routes: RouteOption[];
    selectedRoute: RouteOption | null;
    onSelectRoute: (id: string) => void;
}) {
    if (routes.length === 0) {
        return (
            <div className="px-4 pb-3">
                <div className="rounded-xl border border-border bg-background/80 px-3 py-3 text-sm font-medium text-muted-foreground">
                    Aucun trajet pour cette combinaison.
                </div>
            </div>
        );
    }

    return (
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
    );
}

function MobileRouteSelection({
    routeOption,
    savedRouteId,
    onSaveRoute,
    onPlanRoute,
}: {
    routeOption: RouteOption | null;
    savedRouteId: string;
    onSaveRoute: (routeOption: RouteOption) => void;
    onPlanRoute: (routeOption: RouteOption) => void;
}) {
    if (!routeOption) {
        return null;
    }
    const saved = routeOption.id === savedRouteId;

    return (
        <>
            <div className="grid grid-cols-[1.2fr_0.8fr] gap-2 px-4 pb-3">
                <Button type="button" size="sm" onClick={() => onPlanRoute(routeOption)}>
                    <CalendarPlus className="size-4" aria-hidden="true" />
                    Planifier
                </Button>
                <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => onSaveRoute(routeOption)}>
                    {saved ? <Check className="size-4" aria-hidden="true" /> : <Route className="size-4" aria-hidden="true" />}
                    {saved ? 'Enregistré' : 'Enregistrer'}
                </Button>
            </div>
            <div className="px-4 pb-3">
                <MobileSelectedRouteCard routeOption={routeOption} />
            </div>
        </>
    );
}


export function MobileRouteTab({
    routeOption,
    selected,
    onSelect }: {
        routeOption: RouteOption;
        selected: boolean;
        onSelect: () => void;
    }) {
    const Icon = MODE_ICON[routeOption.modes.at(-1) ?? 'walk'];

    return (
        <button
            type="button"
            className={`grid h-14 min-w-0 grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 rounded-xl border px-2.5 text-left transition ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border/70 bg-background text-foreground'
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

export function MobileSelectedRouteCard({ routeOption }: { routeOption: RouteOption }) {
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
                <Metric label="CO₂e" value={`${routeOption.carbonGrams}g`} compact />
                <Metric label="vs voiture" value={formatCarbonComparisonCompact(routeOption.carbonSavedGrams)} compact />
            </div>
            <div className="mt-3 rounded-lg border border-border/70 bg-background/75 p-2.5">
                <RouteSteps routeOption={routeOption} />
            </div>
        </article>
    );
}
