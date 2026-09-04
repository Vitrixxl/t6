// Liste des choix d'une recherche de lieu. Elle ne lance aucun appel réseau.
import { Building2, Landmark, LocateFixed, MapPin, TrainFront } from 'lucide-react';
import type { GeoPoint } from '../../types';
import type { PlaceKind, PlaceSearchResult } from '../../lib/transport';

const PLACE_KIND_ICON: Record<PlaceKind, typeof MapPin> = {
    Quartier: Landmark,
    Ville: Building2,
    Gare: TrainFront,
    Rue: MapPin,
    Adresse: MapPin,
    Lieu: Landmark,
};

export function PlaceSearchResults({
    currentPosition,
    results,
    status,
    onCurrentPosition,
    onSelect,
}: {
    currentPosition: GeoPoint | null;
    results: PlaceSearchResult[];
    status: string;
    onCurrentPosition: () => void;
    onSelect: (result: PlaceSearchResult) => void;
}) {
    return (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] max-h-[min(52dvh,24rem)] overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-float">
            <button
                type="button"
                className="flex w-full items-start gap-3 border-b border-border px-3 py-2 text-left hover:bg-accent"
                onMouseDown={(event) => event.preventDefault()}
                onClick={onCurrentPosition}
            >
                <LocateFixed className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">
                    <strong className="block truncate text-sm">Ma position</strong>
                    <span className="block truncate text-xs text-muted-foreground">
                        {currentPosition
                            ? `GPS actif${currentPosition.accuracyMeters ? ` - ${Math.round(currentPosition.accuracyMeters)} m` : ''}`
                            : 'Utiliser la position GPS'}
                    </span>
                </span>
            </button>
            {results.map((result) => {
                const KindIcon = PLACE_KIND_ICON[result.kind];
                return (
                    <button
                        key={result.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onSelect(result)}
                    >
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <KindIcon className="size-3.5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <strong className="block truncate text-sm">{result.label}</strong>
                            <span className="block truncate text-xs text-muted-foreground">{result.context || 'Métropole de Lyon'}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {result.kind}
                        </span>
                    </button>
                );
            })}
            {results.length === 0 && status ? <p className="px-3 py-2 text-sm text-muted-foreground">{status}</p> : null}
        </div>
    );
}
