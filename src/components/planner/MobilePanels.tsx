// Module planification - restitution mobile : feuille d'options, composeur de
// modes et actions de planification.
import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { CalendarClock, CalendarPlus, Check, Route } from 'lucide-react';
import { Button } from '../ui/button';
import type {
  CarbonSummary,
  GeoPoint,
  MobilityMode,
  PlannedTrip,
  RouteOption,
  TransportNetwork,
} from '../../types';
import { getRouteColor } from '../../lib/routeColors';
import { formatMeters, Metric, LayerPill, MODE_ICON, MODE_OPTIONS, shiftMobileSheetLevel, MOBILE_SHEET_HEIGHT, type LayerState, type MobileSheetLevel } from '../app/shared';
import { MobileHomePanel } from './MobileHomePanel';

export function MobileTripPanel({
  destination,
  routeRequested,
  routes,
  selectedRoute,
  savedRouteId,
  layers,
  routingApiStatus,
  enabledModes,
  upcomingCount,
  coverageWarning,
  onLayersChange,
  onToggleMode,
  onSelectRoute,
  onSaveRoute,
  onPlanRoute,
  onOpenHub,
  network,
  currentPosition,
  origin,
  upcomingTrip,
  carbonSummary,
  weeklyGoalGrams,
  onUseCurrentPosition }: {
  destination: GeoPoint | null;
  routeRequested: boolean;
  routes: RouteOption[];
  selectedRoute: RouteOption | null;
  savedRouteId: string;
  layers: LayerState;
  routingApiStatus: string;
  enabledModes: MobilityMode[];
  upcomingCount: number;
  coverageWarning: string | null;
  onLayersChange: (layers: LayerState) => void;
  onToggleMode: (mode: MobilityMode) => void;
  onSelectRoute: (id: string) => void;
  onSaveRoute: (routeOption: RouteOption) => void;
  onPlanRoute: (routeOption: RouteOption) => void;
  onOpenHub: () => void;
  network: TransportNetwork;
  currentPosition: GeoPoint | null;
  origin: GeoPoint | null;
  upcomingTrip: PlannedTrip | null;
  carbonSummary: CarbonSummary;
  weeklyGoalGrams: number;
  onUseCurrentPosition: () => void;
}) {
  const [sheetLevel, setSheetLevel] = useState<MobileSheetLevel>('mid');
  const dragStartY = useRef<number | null>(null);
  const dragMoved = useRef(false);
  const sheetSizing = MOBILE_SHEET_HEIGHT[sheetLevel];
  const isCollapsed = sheetLevel === 'collapsed';

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
      className={`absolute inset-x-0 bottom-0 z-30 overflow-hidden rounded-t-[1.6rem] border border-white/80 bg-white/96 pb-[env(safe-area-inset-bottom)] shadow-float backdrop-blur-xl transition-[max-height] duration-300 ease-in-out ${sheetSizing.shell}`}
      data-tour="routes"
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
      <div className={`${sheetSizing.content} overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {routeRequested ? "Options d'itineraire" : 'Reseau en direct'}
            </p>
            <h1 className="truncate text-lg font-semibold tracking-normal">
              {routeRequested ? (destination?.label ?? 'Ou vas-tu ?') : 'Autour de moi'}
            </h1>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onOpenHub} className="relative shrink-0 rounded-full bg-white">
            <CalendarClock className="size-4" aria-hidden="true" />
            Mes trajets
            {upcomingCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-none text-primary-foreground">
                {Math.min(upcomingCount, 9)}
              </span>
            ) : null}
          </Button>
        </div>

        {!routeRequested ? (
          <MobileHomePanel
            network={network}
            currentPosition={currentPosition}
            origin={origin}
            upcomingTrip={upcomingTrip}
            carbonSummary={carbonSummary}
            weeklyGoalGrams={weeklyGoalGrams}
            expanded={sheetLevel === 'expanded'}
            onOpenHub={onOpenHub}
            onUseCurrentPosition={onUseCurrentPosition}
          />
        ) : null}

        {routeRequested && !isCollapsed ? (
          <>
            <div className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <LayerPill active={layers.transitStops} onClick={() => onLayersChange({ ...layers, transitStops: !layers.transitStops })}>
                Arrets
              </LayerPill>
              <LayerPill active={layers.velov} onClick={() => onLayersChange({ ...layers, velov: !layers.velov })}>
                Velo'v
              </LayerPill>
              <LayerPill active={layers.scooters} onClick={() => onLayersChange({ ...layers, scooters: !layers.scooters })}>
                Trottinettes
              </LayerPill>
              <LayerPill active={layers.incidents} onClick={() => onLayersChange({ ...layers, incidents: !layers.incidents })}>
                Incidents
              </LayerPill>
              <LayerPill active={routingApiStatus.includes('OSRM')} onClick={() => undefined}>
                {routingApiStatus}
              </LayerPill>
            </div>
            <MobileModeComposer enabledModes={enabledModes} onToggleMode={onToggleMode} />
          </>
        ) : null}

        {coverageWarning ? (
          <div className="px-4 pb-3">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">{coverageWarning}</p>
          </div>
        ) : null}

        {routeRequested && routes.length > 0 ? (
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
        ) : routeRequested ? (
          <div className="px-4 pb-3">
            <div className="rounded-xl border border-border bg-background/80 px-3 py-3 text-sm font-medium text-muted-foreground">
              Aucun trajet pour cette combinaison.
            </div>
          </div>
        ) : null}

        {selectedRoute ? (
          <div className="grid grid-cols-[1.2fr_0.8fr] gap-2 px-4 pb-3">
            <Button type="button" size="sm" onClick={() => onPlanRoute(selectedRoute)}>
              <CalendarPlus className="size-4" aria-hidden="true" />
              Planifier
            </Button>
            <Button type="button" variant="outline" size="sm" className="bg-white" onClick={() => onSaveRoute(selectedRoute)}>
              {selectedRoute.id === savedRouteId ? <Check className="size-4" aria-hidden="true" /> : <Route className="size-4" aria-hidden="true" />}
              {selectedRoute.id === savedRouteId ? 'Enregistre' : 'Enregistrer'}
            </Button>
          </div>
        ) : null}

        {!isCollapsed && selectedRoute ? (
          <div className="px-4 pb-3">
            <MobileSelectedRouteCard routeOption={selectedRoute} expanded={sheetLevel === 'expanded'} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function MobileModeComposer({
  enabledModes,
  onToggleMode }: {
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

export function MobileSelectedRouteCard({
  routeOption,
  expanded }: {
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
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Etapes de l'itineraire</p>
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
