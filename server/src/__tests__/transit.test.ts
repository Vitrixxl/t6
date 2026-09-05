import { afterEach, describe, expect, it } from 'bun:test';
import { openDatabase, type Db } from '../db';
import { importTimetable } from '../services/transit/import';
import { createTransitRepository } from '../repositories/transit';
import { searchTimetable } from '../services/transit/search';
import { serviceStart } from '../services/transit/time';
import { createTestApi } from './helpers';
import { transitJourneyResult } from '../../../src/contracts/transit';
import type { TimetableImport, TransitSearch } from '../../../src/contracts/transit';

const databases: Db[] = [];
const stop = (id: string, lon: number) => ({
    stop_id: id, stop_name: id, stop_lat: 45.75, stop_lon: lon,
    wheelchair_boarding: 1 as const, parent_station: id, routes: ['T'],
});
const passage = (stopId: string, sequence: number, time: number) => ({
    stopId, sequence, arrival: time, departure: time, pickup: true, dropoff: true,
    shapeIndex: ['A', 'B', 'C'].indexOf(stopId),
});
function fixture(): TimetableImport {
    return {
        metadata: { id: 'test-horaires', importedAt: '2026-09-05T00:00:00Z', startDate: '2026-09-05', endDate: '2026-09-07', timeZone: 'Europe/Paris', maxTimeSeconds: 90000 },
        network: {
            stops: [stop('A', 4.8), stop('B', 4.81), stop('C', 4.82)],
            routes: [{ route_id: 'T', route_short_name: 'T', route_long_name: 'Test', route_type: 0, route_color: '123456', route_text_color: 'FFFFFF', shape: [[4.8, 45.75], [4.81, 45.75], [4.82, 45.75]] }],
        },
        shapes: [{ id: 'shape', points: [[4.8, 45.75], [4.81, 45.75], [4.82, 45.75]] }],
        services: [{ serviceId: 'weekday', date: '2026-09-05' }, { serviceId: 'weekday', date: '2026-09-07' }],
        trips: [
            { id: 'slow', routeId: 'T', shapeId: 'shape', serviceId: 'weekday', headsign: 'C', accessible: true, frequency: null, passages: [passage('A', 1, 8 * 3600 + 300), passage('C', 2, 9 * 3600)] },
            { id: 'fast', routeId: 'T', shapeId: 'shape', serviceId: 'weekday', headsign: 'C', accessible: true, frequency: null, passages: [passage('A', 1, 8 * 3600 + 600), passage('B', 2, 8 * 3600 + 900), passage('C', 3, 8 * 3600 + 1200)] },
        ],
        transfers: [],
    };
}
const request: TransitSearch = {
    departureAt: '2026-09-05T08:00:00+02:00', requireAccessible: false,
    departures: [{ stopId: 'A', durationSeconds: 360, distanceMeters: 300 }],
    arrivals: [{ stopId: 'C', durationSeconds: 120, distanceMeters: 100 }],
};
function setup(data = fixture()) {
    const db = openDatabase(':memory:');
    databases.push(db);
    importTimetable(db, data);
    return createTransitRepository(db);
}
afterEach(() => { for (const db of databases.splice(0)) db.$client.close(); });

describe('horaires de transport', () => {
    it('attend au quai après la marche et choisit la meilleure arrivée', () => {
        const result = searchTimetable(setup(), request);
        expect(result.status).toBe('ready');
        expect(result.journey?.rides[0].tripId).toBe('fast');
        expect(result.journey?.rides[0].readyAt).toBe('2026-09-05T06:06:00.000Z');
        expect(result.journey?.rides[0].departureAt).toBe('2026-09-05T06:10:00.000Z');
        expect(result.journey?.durationSeconds).toBe(1320);
    });
    it('ne reprend ni un départ manqué ni le sens opposé', () => {
        const repo = setup();
        expect(searchTimetable(repo, { ...request, departureAt: '2026-09-05T08:10:01+02:00' }).status).toBe('no-service');
        expect(searchTimetable(repo, { ...request, departures: request.arrivals, arrivals: request.departures }).status).toBe('no-service');
    });
    it('respecte le calendrier et distingue une date hors couverture', () => {
        const repo = setup();
        expect(searchTimetable(repo, { ...request, departureAt: '2026-09-06T08:30:00+02:00' }).status).toBe('no-service');
        expect(searchTimetable(repo, { ...request, departureAt: '2026-10-01T08:00:00+02:00' }).status).toBe('outside-coverage');
    });
    it('conserve la journée de service pour les passages après minuit', () => {
        const data = fixture();
        data.trips = [{ ...data.trips[0], passages: [passage('A', 1, 25 * 3600), passage('C', 2, 25 * 3600 + 600)] }];
        const result = searchTimetable(setup(data), { ...request, departureAt: '2026-09-06T00:50:00+02:00' });
        expect(result.journey?.rides[0].departureAt).toBe('2026-09-05T23:00:00.000Z');
    });
    it('recalcule une correspondance et applique les transferts interdits', () => {
        const data = fixture();
        data.trips = [
            { ...data.trips[0], id: 'first', passages: [passage('A', 1, 29400), passage('B', 2, 29700)] },
            { ...data.trips[0], id: 'missed', passages: [passage('B', 1, 29800), passage('C', 2, 30000)] },
            { ...data.trips[0], id: 'next', passages: [passage('B', 1, 30300), passage('C', 2, 30600)] },
        ];
        const result = searchTimetable(setup(data), request);
        expect(result.journey?.rides.map((ride) => ride.tripId)).toEqual(['first', 'next']);
        data.metadata.id = 'forbidden';
        data.transfers = [{ fromStopId: 'B', toStopId: 'B', minimumSeconds: 0, forbidden: true, estimated: false }];
        expect(searchTimetable(setup(data), request).status).toBe('no-service');
    });
    it('un import incohérent conserve la version active', () => {
        const db = openDatabase(':memory:'); databases.push(db);
        importTimetable(db, fixture());
        const bad = fixture(); bad.metadata.id = 'broken'; bad.trips[0].passages[0].stopId = 'absent';
        expect(() => importTimetable(db, bad)).toThrow();
        expect(createTransitRepository(db).active()?.id).toBe('test-horaires');
    });
    it('une fréquence non cadencée reste une attente estimée', () => {
        const data = fixture();
        data.trips = [{ ...data.trips[1], frequency: { start: 28800, end: 36000, headway: 600, exact: false } }];
        const result = searchTimetable(setup(data), request);
        expect(result.journey?.rides[0].departureAt).toBe('2026-09-05T06:11:00.000Z');
        expect(result.journey?.rides[0].timing).toBe('frequency');
    });
    it('une fréquence exacte respecte sa grille de départs', () => {
        const data = fixture();
        data.trips = [{ ...data.trips[1], frequency: { start: 28800, end: 36000, headway: 600, exact: true } }];
        const result = searchTimetable(setup(data), request);
        expect(result.journey?.rides[0].departureAt).toBe('2026-09-05T06:10:00.000Z');
        expect(result.journey?.rides[0].timing).toBe('scheduled');
    });
    it('une prise du véhicule plus longue fait manquer le premier départ', () => {
        const result = searchTimetable(setup(), { ...request, departures: [{ ...request.departures[0], durationSeconds: 601 }] });
        expect(result.status).toBe('no-service');
    });
    it('respecte les restrictions de montée et l’accessibilité', () => {
        const data = fixture();
        for (const trip of data.trips) trip.passages[0].pickup = false;
        expect(searchTimetable(setup(data), request).status).toBe('no-service');
        const inaccessible = fixture();
        for (const trip of inaccessible.trips) trip.accessible = false;
        expect(searchTimetable(setup(inaccessible), { ...request, requireAccessible: true }).status).toBe('no-service');
    });
    it('ancre la journée GTFS à midi moins douze heures aux changements d’heure', () => {
        expect(new Date(serviceStart('2026-03-29', 'Europe/Paris')).toISOString()).toBe('2026-03-28T22:00:00.000Z');
        expect(new Date(serviceStart('2026-10-25', 'Europe/Paris')).toISOString()).toBe('2026-10-24T23:00:00.000Z');
    });
    it('sert les horaires par GET et refuse les paramètres invalides', async () => {
        const api = createTestApi();
        try {
            const path = `/api/transit/journeys?search=${encodeURIComponent(JSON.stringify(request))}`;
            const absent = await api.call(path);
            expect(transitJourneyResult.parse(await absent.json()).status).toBe('unavailable');
            importTimetable(api.db, fixture());
            const response = await api.call(path);
            expect(response.status).toBe(200);
            expect(response.headers.get('cache-control')).toBe('no-store');
            expect(transitJourneyResult.parse(await response.json()).journey?.rides[0].tripId).toBe('fast');
            expect((await api.call('/api/transit/journeys?search=invalid')).status).toBe(422);
            expect((await api.call('/api/transit/journeys?search=%7B%7D')).status).toBe(422);
            expect((await api.call('/api/transit/network')).status).toBe(200);
        } finally { api.close(); }
    });
});
