// Module planification - recherche : saisie depart/arrivee, géocodage BAN + Photon.
import { ArrowUpDown, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import type { GeoPoint } from '../../types';
import { PlaceSearchResults } from './PlaceSearchResults';
import { usePlaceSearch } from './usePlaceSearch';

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
                    placeholder="Adresse de départ"
                    className="min-w-0 flex-1"
                />
                <PlaceSearchBox
                    searchOrigin={origin}
                    value={destination}
                    currentPosition={currentPosition}
                    onCurrentPositionRequest={onCurrentPositionRequest}
                    onSelect={onDestinationSelect}
                    inputId="desktop-destination-search"
                    placeholder="Adresse d'arrivée"
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
    // qu'une question — où va-t-on ? Demander un départ avant de savoir cela
    // impose de remplir deux champs pour obtenir une réponse, alors que le
    // départ est presque toujours la position courante.
    //
    // Une fois la destination choisie, les deux champs apparaissent, avec
    // l'inversion : c'est le moment où le trajet retour devient une intention
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
                    placeholder="Où vas-tu ?"
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
                    placeholder="Départ"
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
                    placeholder="Arrivée"
                    className="min-w-0"
                    compact
                />
            </div>
            <button
                type="button"
                onClick={onSwap}
                disabled={!origin}
                aria-label="Inverser départ et arrivée"
                // Taille en pixels : la racine du document est à 14 px, une valeur en
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
    const search = usePlaceSearch({
        searchOrigin,
        value,
        currentPosition,
        requestCurrentPosition: onCurrentPositionRequest,
        onSelect,
    });

    return (
        <div className={`relative ${className ?? ''}`}>
            <label className="sr-only" htmlFor={inputId}>
                {placeholder}
            </label>
            <div className="relative">
                <Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground ${compact ? 'size-3.5' : 'size-4'}`} aria-hidden="true" />
                <Input
                    id={inputId}
                    value={search.query}
                    onFocus={() => search.setOpen(true)}
                    onBlur={() => {
                        search.setOpen(false);
                        search.setQuery(value?.label ?? '');
                    }}
                    onChange={(event) => {
                        search.setQuery(event.target.value);
                        search.setOpen(true);
                    }}
                    placeholder={placeholder}
                    className={`${compact ? 'h-9 text-[0.95rem]' : 'h-10'} rounded-lg border-0 bg-transparent pl-9 shadow-none focus-visible:bg-background/60 focus-visible:ring-0`}
                    autoComplete="off"
                />
            </div>
            {search.open ? (
                <PlaceSearchResults
                    currentPosition={currentPosition}
                    results={search.results}
                    status={search.status}
                    onCurrentPosition={() => void search.selectCurrentPosition()}
                    onSelect={search.selectResult}
                />
            ) : null}
        </div>
    );
}
