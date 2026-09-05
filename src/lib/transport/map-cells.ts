import { STOP_CELLS_PER_DEGREE, STOP_MIN_ZOOM } from '../../contracts/transport';

export interface MapBounds { west: number; south: number; east: number; north: number }
export interface StopCell { x: number; y: number }

export function visibleStopCells(bounds: MapBounds, zoom: number): StopCell[] {
    // À l'échelle régionale, des milliers de quais superposés ne sont pas
    // lisibles. Le message de la carte invite à zoomer, sans compteur tronqué.
    if (zoom < STOP_MIN_ZOOM) return [];
    const cells: StopCell[] = [];
    const west = Math.max(-180, bounds.west);
    const east = Math.min(180, bounds.east);
    const south = Math.max(-90, bounds.south);
    const north = Math.min(90, bounds.north);
    for (let x = Math.floor(west * STOP_CELLS_PER_DEGREE); x < Math.ceil(east * STOP_CELLS_PER_DEGREE); x++) {
        for (let y = Math.floor(south * STOP_CELLS_PER_DEGREE); y < Math.ceil(north * STOP_CELLS_PER_DEGREE); y++) {
            cells.push({ x, y });
        }
    }
    return cells;
}
