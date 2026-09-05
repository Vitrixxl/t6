// Le mouvement ne provoque aucune requête intermédiaire. Une cellule déborde
// légèrement du cadre et sert aussi de marge lors du déplacement suivant.
import { useEffect, useState, type RefObject } from 'react';
import type { Map } from 'maplibre-gl';
import { visibleStopCells, type StopCell } from '../../lib/transport/map-cells';
import { useMapStops } from '../../queries/map-stops';
import { STOP_MIN_ZOOM } from '../../contracts/transport';

export function useVisibleMapStops(mapRef: RefObject<Map | null>, loaded: boolean, enabled: boolean, version: string) {
    const [cells, setCells] = useState<StopCell[]>([]);
    const [zoomedOut, setZoomedOut] = useState(false);
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !loaded) return;
        let timer: ReturnType<typeof setTimeout>;
        const update = () => {
            const bounds = map.getBounds();
            setZoomedOut(map.getZoom() < STOP_MIN_ZOOM);
            const next = visibleStopCells({ west: bounds.getWest(), east: bounds.getEast(), south: bounds.getSouth(), north: bounds.getNorth() }, map.getZoom());
            setCells(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
        };
        const schedule = () => { clearTimeout(timer); timer = setTimeout(update, 180); };
        map.on('moveend', schedule);
        map.on('resize', schedule);
        update();
        return () => {
            clearTimeout(timer);
            map.off('moveend', schedule);
            map.off('resize', schedule);
        };
    }, [loaded, mapRef]);
    const queries = useMapStops(enabled ? cells : [], version);
    return {
        stops: queries.flatMap(query => query.data?.stops ?? []),
        message: !enabled ? null : zoomedOut ? 'Zoomez pour afficher les arrêts TCL.'
            : queries.some(query => query.isError) ? 'Certains arrêts TCL n’ont pas pu être chargés.'
                : queries.some(query => query.isPending) ? 'Chargement des arrêts TCL…' : null,
        failed: queries.some(query => query.isError),
        retry: () => { for (const query of queries.filter(query => query.isError)) void query.refetch(); },
    };
}
