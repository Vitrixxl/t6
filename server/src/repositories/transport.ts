// Seul ce dépôt interroge le réseau persisté. L'index R*Tree élimine les quais
// lointains ; le second filtre exact compense l'arrondi flottant de l'index.
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import type { Executor } from '../db/index.ts';
import { transportMetadata, transportStops, transportRoutes, transportTrips } from '../db/schema.ts';
import type { GtfsFeed } from '../../../src/types.ts';

export interface StopBounds { west: number; south: number; east: number; north: number }

export function createTransportRepository(db: Executor) {
    return {
        metadata() { return db.select().from(transportMetadata).get(); },
        readNetwork(): GtfsFeed {
            const meta = db.select().from(transportMetadata).get();
            if (!meta) throw new Error('Réseau TCL non importé.');
            return {
                agency: meta.agency,
                stops: db.select().from(transportStops).all().map(row => row.payload),
                routes: db.select().from(transportRoutes).all().map(row => row.payload),
                trips: db.select().from(transportTrips).all().map(row => row.payload),
            };
        },
        stopsInBounds(bounds: StopBounds) {
            return db.select({ stop: transportStops.payload }).from(transportStops).where(and(
                sql`${transportStops.id} IN (
                    SELECT id FROM transport_stop_index
                    WHERE max_lon >= ${bounds.west} AND min_lon <= ${bounds.east}
                      AND max_lat >= ${bounds.south} AND min_lat <= ${bounds.north}
                )`,
                gte(transportStops.lon, bounds.west), lt(transportStops.lon, bounds.east),
                gte(transportStops.lat, bounds.south), lt(transportStops.lat, bounds.north),
            )).all().map(row => row.stop);
        },
        importNetwork(feed: GtfsFeed, version: string) {
            // L'appelant fournit une transaction ; les lecteurs ne voient jamais
            // une moitié de version, ni des quais désynchronisés de leurs lignes.
            db.delete(transportStops).run();
            db.delete(transportRoutes).run();
            db.delete(transportTrips).run();
            for (const [id, stop] of feed.stops.entries()) {
                db.insert(transportStops).values({ id, stopId: stop.stop_id, lat: stop.stop_lat, lon: stop.stop_lon, payload: stop }).run();
            }
            for (const route of feed.routes) db.insert(transportRoutes).values({ id: route.route_id, payload: route }).run();
            for (const trip of feed.trips) db.insert(transportTrips).values({ id: trip.trip_id, payload: trip }).run();
            db.insert(transportMetadata).values({ id: 1, version, agency: feed.agency })
                .onConflictDoUpdate({ target: transportMetadata.id, set: { version, agency: feed.agency } }).run();
        },
        hasVersion(version: string) {
            return Boolean(db.select({ id: transportMetadata.id }).from(transportMetadata).where(eq(transportMetadata.version, version)).get());
        },
    };
}
export type TransportRepository = ReturnType<typeof createTransportRepository>;
