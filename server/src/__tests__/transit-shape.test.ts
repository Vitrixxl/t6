import { describe, expect, it } from 'bun:test';
import type { GtfsRoute } from '../../../src/types.ts';
import type { MotisLeg } from '../services/motis/client.ts';
import { transitShape } from '../services/motis/transit-shape.ts';

const route: GtfsRoute = {
    route_id: 'T1', route_short_name: 'T1', route_long_name: 'Tracé test', route_type: 0,
    route_color: '112233', route_text_color: 'FFFFFF',
    shape: [[4.8, 45.7], [4.81, 45.7], [4.81, 45.71], [4.82, 45.71]],
};
const from = { name: 'Départ', lat: 45.7, lon: 4.805, stopId: 'tcl_1' };
const to = { name: 'Arrivée', lat: 45.71, lon: 4.815, stopId: 'tcl_3' };
const leg: MotisLeg = { from, to, mode: 'TRAM', routeShortName: 'T1', routeType: 0, duration: 300, legGeometry: { points: '', precision: 6 } };

describe('tracé officiel TCL', () => {
    it('découpe la vraie courbe aux quais, dans les deux sens du rail', () => {
        const path = transitShape(leg, [route]);
        expect(path.map(point => [point.lon, point.lat])).toEqual([[4.805, 45.7], [4.81, 45.7], [4.81, 45.71], [4.815, 45.71]]);
        expect(transitShape({ ...leg, from: to, to: from }, [route])).toEqual(path.toReversed());
    });
    it('refuse une ligne, une branche ou un ordre des arrêts incompatibles', () => {
        expect(transitShape({ ...leg, routeShortName: 'T2' }, [route])).toEqual([]);
        expect(transitShape({ ...leg, to: { ...to, lat: 45.72 } }, [route])).toEqual([]);
        expect(transitShape({ ...leg, intermediateStops: [{ ...to, lon: 4.819 }] }, [route])).toEqual([]);
        expect(transitShape(leg, [route, { ...route, route_id: 'variante' }])).toEqual([]);
    });
    it('exige les quais physiques dans le bon sens pour le bus', () => {
        const bus = { ...route, route_type: 3, stopSequence: ['bus-stop:1', 'bus-stop:2', 'bus-stop:3'] };
        const busLeg = { ...leg, mode: 'BUS', routeType: 3 };
        expect(transitShape(busLeg, [bus])).toHaveLength(4);
        expect(transitShape({ ...busLeg, from: { ...from, stopId: 'tcl_bus-stop:1' } }, [bus])).toHaveLength(4);
        expect(transitShape({ ...busLeg, routeType: 702 }, [bus])).toHaveLength(4);
        expect(transitShape({ ...busLeg, from: to, to: from }, [bus])).toEqual([]);
        expect(transitShape({ ...busLeg, from: { ...from, stopId: 'tcl_autre_quai' } }, [bus])).toEqual([]);
        expect(transitShape(busLeg, [{ ...bus, stopSequence: undefined }])).toEqual([]);
    });
});
