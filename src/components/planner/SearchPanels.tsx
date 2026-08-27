// Module planification - recherche : saisie depart/arrivee, geocodage BAN + Photon.
import { useEffect, useState } from 'react';
import { Building2, CalendarClock, Landmark, LocateFixed, MapPin, PanelLeftClose, PanelLeftOpen, Navigation, Search, TrainFront, UserRound} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { GeoPoint} from '../../types';
import { searchPlaces, type PlaceKind, type PlaceSearchResult } from '../../lib/transport';

const PLACE_KIND_ICON: Record<PlaceKind, typeof MapPin> = {
  Quartier: Landmark,
  Ville: Building2,
  Gare: TrainFront,
  Rue: MapPin,
  Adresse: MapPin,
  Lieu: Landmark,
};

export function CommandSearchBar({
  leftRailOpen,
  onToggleLeftRail,
  origin,
  destination,
  currentPosition,
  onCurrentPositionRequest,
  onOriginSelect,
  onDestinationSelect }: {
  leftRailOpen: boolean;
  onToggleLeftRail: () => void;
  origin: GeoPoint | null;
  destination: GeoPoint | null;
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

export function MobileSearchShell({
  origin,
  destination,
  upcomingCount,
  currentPosition,
  onOriginSelect,
  onDestinationSelect,
  onCurrentPositionRequest,
  onOpenTrips,
  onOpenProfile }: {
  origin: GeoPoint | null;
  destination: GeoPoint | null;
  upcomingCount: number;
  currentPosition: GeoPoint | null;
  onOriginSelect: (point: GeoPoint) => void;
  onDestinationSelect: (point: GeoPoint) => void;
  onCurrentPositionRequest: () => Promise<GeoPoint | null>;
  onOpenTrips: () => void;
  onOpenProfile: () => void;
}) {
  return (
    <div className="relative z-[70] grid grid-cols-[2.5rem_minmax(0,1fr)_2.75rem_2.75rem] items-center gap-2 rounded-2xl border border-white/80 bg-white/95 px-2 py-2 shadow-float backdrop-blur-xl">
      <div className="grid size-10 place-items-center self-start rounded-xl bg-primary text-primary-foreground">
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
      <Button
        type="button"
        variant="outline"
        onClick={onOpenTrips}
        aria-label="Ouvrir le planificateur"
        className="relative h-11 w-11 rounded-xl p-0"
        data-tour="trips"
      >
        <CalendarClock className="size-5" aria-hidden="true" />
        {upcomingCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
            {Math.min(upcomingCount, 9)}
          </span>
        ) : null}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onOpenProfile}
        aria-label="Ouvrir le profil"
        className="h-11 w-11 rounded-xl p-0"
        data-tour="profile"
      >
        <UserRound className="size-5" aria-hidden="true" />
      </Button>
    </div>
  );
}

export function PlaceSearchBox({
  searchOrigin,
  value,
  currentPosition,
  onCurrentPositionRequest,
  onSelect,
  inputId,
  placeholder,
  className,
  compact = false }: {
  searchOrigin: GeoPoint | null;
  value: GeoPoint | null;
  currentPosition: GeoPoint | null;
  onCurrentPositionRequest: () => Promise<GeoPoint | null>;
  onSelect: (point: GeoPoint) => void;
  inputId: string;
  placeholder: string;
  className?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState(value?.label ?? '');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setQuery(value?.label ?? '');
  }, [value]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!open || trimmedQuery.length < 2 || trimmedQuery === value?.label) {
      setResults([]);
      setStatus('');
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setStatus('Recherche en cours');
      searchPlaces(trimmedQuery, searchOrigin ?? undefined, controller.signal)
        .then((items) => {
          setResults(items);
          setStatus(items.length > 0 ? '' : 'Aucun resultat dans la metropole de Lyon');
        })
        .catch(() => {
          setResults([]);
          setStatus('Recherche indisponible');
        });
    }, 220);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, searchOrigin, value?.label]);

  const handleSelect = (result: PlaceSearchResult) => {
    onSelect({
      label: result.label,
      lat: result.lat,
      lon: result.lon });
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
      label: 'Ma position' };
    onSelect(nextPoint);
    setQuery(nextPoint.label);
    setOpen(false);
  };

  const showCurrentPositionOption = open;
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
          onBlur={() => {
            setOpen(false);
            setQuery(value?.label ?? '');
          }}
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
          {results.map((result) => {
            const KindIcon = PLACE_KIND_ICON[result.kind] ?? MapPin;
            return (
              <button
                key={result.id}
                type="button"
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(result)}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <KindIcon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{result.label}</strong>
                  <span className="block truncate text-xs text-muted-foreground">{result.context || 'Metropole de Lyon'}</span>
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {result.kind}
                </span>
              </button>
            );
          })}
          {results.length === 0 && status ? <p className="px-3 py-2 text-sm text-muted-foreground">{status}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

