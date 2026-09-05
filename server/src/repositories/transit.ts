import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import type { TimetableImport } from '../../../src/contracts/transit.ts';
import type { Executor } from '../db/index.ts';
import { transitBoardings, transitFeeds, transitServiceDays, transitShapes, transitTrips } from '../db/schema.ts';

export function createTransitRepository(db: Executor) {
    return {
        active() {
            return db.select().from(transitFeeds).where(eq(transitFeeds.active, true)).get() ?? null;
        },
        find(id: string) {
            return db.select().from(transitFeeds).where(eq(transitFeeds.id, id)).get() ?? null;
        },
        insertFeed(data: TimetableImport) {
            db.insert(transitFeeds).values({
                id: data.metadata.id, metadata: data.metadata, network: data.network, transfers: data.transfers,
            }).run();
        },
        insertService(feedId: string, service: TimetableImport['services'][number]) {
            db.insert(transitServiceDays).values({ feedId, ...service }).run();
        },
        insertShape(feedId: string, shape: TimetableImport['shapes'][number]) {
            db.insert(transitShapes).values({ feedId, ...shape }).run();
        },
        insertTrip(feedId: string, trip: TimetableImport['trips'][number]) {
            db.insert(transitTrips).values({ feedId, id: trip.id, serviceId: trip.serviceId, trip }).run();
            for (const passage of trip.passages.filter((item) => item.pickup)) {
                const departure = trip.frequency
                    ? trip.frequency.end + passage.departure - trip.passages[0].departure
                    : passage.departure;
                db.insert(transitBoardings).values({ feedId, tripId: trip.id, stopId: passage.stopId, departure }).run();
            }
        },
        activate(id: string) {
            db.update(transitFeeds).set({ active: false }).where(eq(transitFeeds.active, true)).run();
            db.update(transitFeeds).set({ active: true }).where(eq(transitFeeds.id, id)).run();
        },
        departures(feedId: string, date: string, stopIds: string[], after: number, before: number) {
            if (stopIds.length === 0) return [];
            return db.selectDistinct({ trip: transitTrips.trip })
                .from(transitBoardings)
                .innerJoin(transitTrips, and(eq(transitTrips.feedId, transitBoardings.feedId), eq(transitTrips.id, transitBoardings.tripId)))
                .innerJoin(transitServiceDays, and(eq(transitServiceDays.feedId, transitTrips.feedId), eq(transitServiceDays.serviceId, transitTrips.serviceId)))
                .where(and(
                    eq(transitBoardings.feedId, feedId), eq(transitServiceDays.date, date),
                    inArray(transitBoardings.stopId, stopIds),
                    gte(transitBoardings.departure, after), lte(transitBoardings.departure, before),
                )).all().map((row) => row.trip);
        },
        shape(feedId: string, id: string) {
            return db.select({ points: transitShapes.points }).from(transitShapes)
                .where(and(eq(transitShapes.feedId, feedId), eq(transitShapes.id, id))).get()?.points ?? null;
        },
    };
}

export type TransitRepository = ReturnType<typeof createTransitRepository>;
