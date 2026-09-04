// Module planification - recherche : saisie depart/arrivee, geocodage BAN + Photon.
import { useEffect, useState } from 'react';
import { ArrowUpDown, Building2, Landmark, LocateFixed, MapPin, PanelLeftClose, PanelLeftOpen, Search, TrainFront } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { GeoPoint } from '../../types';
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
    currentPosition,
    onOriginSelect,
    onDestinationSelect,
    onSwap,
    onCurrentPositionRequest }: {
        origin: GeoPoint | null;
        destination: GeoPoint | null;
        currentPosition: GeoPoint | null;
        onOriginSelect: (point: GeoPoint) => void;
        onDestinationSelect: (point: GeoPoint) => void;
        onSwap: () => void;
        onCurrentPositionRequest: () => Promise<GeoPoint | null>;
    }) {
    // Deux temps. Tant qu'aucune destination n'est choisie, la barre ne pose
    // qu'une question — ou va-t-on ? Demander un depart avant de savoir cela
    // impose de remplir deux champs pour obtenir une reponse, alors que le
    // depart est presque toujours la position courante.
    //
    // Une fois la destination choisie, les deux champs apparaissent, avec
    // l'inversion : c'est le moment ou le trajet retour devient une intention
    // plausible, pas avant.
    const expanded = destination !== null;

    if (!expanded) {
        return (
            <div className="relative z-[70] flex items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-2.5 shadow-float backdrop-blur-xl">
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <PlaceSearchBox
                    searchOrigin={origin ?? currentPosition}
                    value={destination}
                    currentPosition={currentPosition}
                    onCurrentPositionRequest={onCurrentPositionRequest}
                    onSelect={onDestinationSelect}
                    inputId="mobile-destination-search"
                    placeholder="Ou vas-tu ?"
                    className="min-w-0 flex-1"
                    compact
                />
            </div>
        );
    }

    return (
        <div className="relative z-[70] grid grid-cols-[1.25rem_minmax(0,1fr)_3rem] items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 shadow-float backdrop-blur-xl">
            <div className="flex h-full flex-col items-center justify-center gap-1.5 py-1.5" aria-hidden="true">
                <span className="size-2.5 rounded-full border-2 border-primary bg-card" />
                <span className="w-px flex-1 bg-border/90" />
                <span className="size-2.5 rounded-[3px] bg-destructive" />
            </div>
            <div className="grid min-w-0 gap-1.5">
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
                <div className="mx-1 h-px bg-border/70" aria-hidden="true" />
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
            <button
                type="button"
                onClick={onSwap}
                disabled={!origin}
                aria-label="Inverser depart et arrivee"
                // Taille en pixels : la racine du document est a 14 px, une valeur en
                // rem raterait la cible tactile de 44 px.
                className="grid size-[44px] place-items-center justify-self-end rounded-xl border border-border/80 bg-secondary text-primary shadow-soft transition-colors hover:bg-accent active:bg-muted disabled:opacity-40"
            >
                <ArrowUpDown className="size-4.5" aria-hidden="true" />
            </button>
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
            lon: result.lon
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
            label: 'Ma position'
        };
        onSelect(nextPoint);
        setQuery(nextPoint.label);
        setOpen(false);
    };

    const showCurrentPositionOption = open;
    const showDropdown = open && (showCurrentPositionOption || results.length > 0 || status);

    return (
        <div className={`relative ${className ?? ''}`}>
            <label className="sr-only" htmlFor={inputId}>
                {placeholder}
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
                    className={`${compact ? 'h-9 text-[0.95rem]' : 'h-10'} rounded-lg border-0 bg-transparent pl-9 shadow-none focus-visible:bg-background/60 focus-visible:ring-0`}
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
