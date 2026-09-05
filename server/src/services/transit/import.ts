import { timetableImport, type TimetableImport } from '../../../../src/contracts/transit.ts';
import type { Db } from '../../db/index.ts';
import { createTransitRepository } from '../../repositories/transit.ts';

function validateReferences(data: TimetableImport): void {
    const stops = new Set(data.network.stops.map((stop) => stop.stop_id));
    const routes = new Set(data.network.routes.map((route) => route.route_id));
    const shapes = new Map(data.shapes.map((shape) => [shape.id, shape.points]));
    const services = new Set(data.services.map((service) => service.serviceId));
    for (const trip of data.trips) {
        if (!routes.has(trip.routeId) || !shapes.has(trip.shapeId) || !services.has(trip.serviceId)) {
            throw new Error(`Course ${trip.id} : ligne, tracé ou calendrier absent.`);
        }
        validatePassages(trip, stops, shapes.get(trip.shapeId)?.length ?? 0);
    }
}

function validatePassages(trip: TimetableImport['trips'][number], stops: Set<string>, shapeLength: number): void {
    let sequence = -1;
    let departure = -1;
    let shapeIndex = -1;
    for (const passage of trip.passages) {
        if (!stops.has(passage.stopId) || passage.sequence <= sequence || passage.arrival < departure
            || passage.shapeIndex <= shapeIndex || passage.shapeIndex >= shapeLength) {
            throw new Error(`Course ${trip.id} : arrêt absent ou passages non chronologiques.`);
        }
        sequence = passage.sequence;
        departure = passage.departure;
        shapeIndex = passage.shapeIndex;
    }
}

export function importTimetable(db: Db, input: unknown): TimetableImport['metadata'] {
    const data = timetableImport.parse(input);
    validateReferences(data);
    if (data.metadata.startDate > data.metadata.endDate) throw new Error('Période horaire inversée.');
    // Une archive et son activation forment une seule transaction : ni import
    // partiel ni panne de téléchargement ne peuvent effacer la version active.
    db.transaction((tx) => {
        const repository = createTransitRepository(tx);
        if (!repository.find(data.metadata.id)) {
            repository.insertFeed(data);
            for (const service of data.services) repository.insertService(data.metadata.id, service);
            for (const shape of data.shapes) repository.insertShape(data.metadata.id, shape);
            for (const trip of data.trips) repository.insertTrip(data.metadata.id, trip);
        }
        repository.activate(data.metadata.id);
    });
    return data.metadata;
}
