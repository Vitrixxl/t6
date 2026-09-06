import { expect, it } from 'bun:test';
import type { MotisItinerary, MotisLeg } from '../services/motis/client.ts';
import { boardingWaits } from '../services/motis/timing.ts';
import { toRouteOption } from '../services/motis/options.ts';

const origin = { label: 'Départ', lat: 45.76, lon: 4.85 };
const destination = { label: 'Arrivée', lat: 45.75, lon: 4.86 };
const departureAt = '2026-09-06T12:00:00Z';
function leg(mode: string, duration: number, startTime?: string, endTime?: string): MotisLeg {
    return { mode, duration, startTime, endTime, from: { ...origin, name: 'START' }, to: { ...destination, name: 'END' }, legGeometry: { points: '', precision: 5 }, routeShortName: mode === 'BUS' ? 'TB12' : undefined };
}
const itinerary: MotisItinerary = {
    startTime: '2026-09-06T12:02:00Z', endTime: '2026-09-06T12:30:00Z', duration: 1680, transfers: 1,
    legs: [
        leg('WALK', 300),
        leg('BUS', 600, '2026-09-06T12:07:00Z', '2026-09-06T12:17:00Z'),
        leg('WALK', 120),
        leg('TRAM', 300, '2026-09-06T12:23:00Z', '2026-09-06T12:28:00Z'),
        leg('WALK', 120),
    ],
};

it('affecte le départ différé à la première attente et conserve celle de correspondance', () => {
    expect(boardingWaits(itinerary, departureAt)).toEqual([undefined, 120, undefined, 240, undefined]);
    const route = toRouteOption(itinerary, { origin, destination, departureAt, accessibilityNeed: false });
    expect(route.departureAt).toBe(departureAt);
    expect(route.durationMinutes).toBe(30);
    expect(route.legs.reduce((sum, leg) => sum + leg.durationMinutes * 60 + (leg.waitingSeconds ?? 0), 0)).toBe(1800);
    expect(route.legs[1]).toMatchObject({ transitType: 3, lineCode: 'TB12', boardingAt: '2026-09-06T12:07:00Z', waitingSeconds: 120 });
});

it('distingue une attente nulle d’un horaire absent, sans inventer les correspondances suivantes', () => {
    expect(boardingWaits({ ...itinerary, legs: [leg('BUS', 60, departureAt), leg('TRAM', 60, '2026-09-06T12:02:00Z')] }, departureAt)).toEqual([0, undefined]);
    expect(boardingWaits({ ...itinerary, legs: [leg('BUS', 60)] }, departureAt)).toEqual([undefined]);
});

it('compte la prise du vélo et toute la marche avant l’embarquement', () => {
    const legs = [leg('WALK', 60), leg('RENTAL', 120), leg('WALK', 60), leg('BUS', 600, '2026-09-06T12:04:30Z', '2026-09-06T12:14:30Z')];
    expect(boardingWaits({ ...itinerary, legs }, departureAt)).toEqual([undefined, undefined, undefined, 30]);
});
