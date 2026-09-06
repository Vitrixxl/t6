import { useAtom } from 'jotai';
import type { RouteOption } from '../../types';
import { routeSelectionAtom } from '../../state';

/** Une nouvelle recherche sélectionne la première arrivée ; un choix manuel reste local à sa recherche. */
export function useRouteSelection(options: RouteOption[], queryKey: string) {
    const [selection, setSelection] = useAtom(routeSelectionAtom);
    const selectedId = selection?.queryKey === queryKey ? selection.routeId : null;
    const route = options.find(option => option.id === selectedId) ?? options[0] ?? null;
    const selectRoute = (routeId: string) => setSelection({ queryKey, routeId });
    return { route, selectRoute };
}
