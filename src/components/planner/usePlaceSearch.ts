// État d'une recherche de lieu : saisie, temporisation, annulation et choix.
// Le composant visuel ne connaît ainsi ni le géocodeur ni son cycle réseau.
import { useEffect, useState } from 'react';
import type { GeoPoint } from '../../types';
import { searchPlaces, type PlaceSearchResult } from '../../lib/transport';

export function usePlaceSearch(input: {
    searchOrigin: GeoPoint | null;
    value: GeoPoint | null;
    currentPosition: GeoPoint | null;
    requestCurrentPosition: () => Promise<GeoPoint | null>;
    onSelect: (point: GeoPoint) => void;
}) {
    const [query, setQuery] = useState(input.value?.label ?? '');
    const [results, setResults] = useState<PlaceSearchResult[]>([]);
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        setQuery(input.value?.label ?? '');
    }, [input.value]);

    useEffect(() => {
        const trimmedQuery = query.trim();
        if (!open || trimmedQuery.length < 2 || trimmedQuery === input.value?.label) {
            setResults([]);
            setStatus('');
            return;
        }

        const controller = new AbortController();
        const timeout = window.setTimeout(() => {
            setStatus('Recherche en cours');
            searchPlaces(trimmedQuery, input.searchOrigin ?? undefined, controller.signal)
                .then((items) => {
                    setResults(items);
                    setStatus(items.length > 0 ? '' : 'Aucun résultat dans la métropole de Lyon');
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
    }, [input.searchOrigin, input.value?.label, open, query]);

    const selectResult = (result: PlaceSearchResult): void => {
        input.onSelect({ label: result.label, lat: result.lat, lon: result.lon });
        setQuery(result.label);
        setOpen(false);
    };

    const selectCurrentPosition = async (): Promise<void> => {
        const position = input.currentPosition ?? (await input.requestCurrentPosition());
        if (!position) {
            setStatus('GPS indisponible');
            setOpen(true);
            return;
        }
        const point = { ...position, label: 'Ma position' };
        input.onSelect(point);
        setQuery(point.label);
        setOpen(false);
    };

    return { query, setQuery, results, open, setOpen, status, selectResult, selectCurrentPosition };
}
