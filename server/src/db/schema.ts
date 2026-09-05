import type { GtfsAgency, GtfsStop, GtfsRoute, GtfsTrip, WeatherSignal } from '../../../src/types';
// Schéma de la base, source unique pour Drizzle.
//
// Chaque table est déclarée une fois ici ; drizzle-kit en dérive les
// migrations SQL (server/drizzle/) et Drizzle en dérive le type des lignes.
// Les colonnes gardent leur nom snake_case en base pour rester lisibles à un
// DBA, et prennent un nom camelCase côté TypeScript pour coller au domaine.
import { desc, sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { PLANNED_TRIP_STATUSES, type CancelledPassage } from '../../../src/contracts/trips.ts';
import type { MobilityMode, MobilityProfile, RoutinePeriod } from '../../../src/types.ts';
import type { TimetableMetadata, TimetableTrip, TransitNetwork, TimetableTransfer } from '../../../src/contracts/transit.ts';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    // Empreinte argon2id auto-decrite ($argon2id$v=19$m=...,t=...,p=...$...) :
    // les paramètres de coût voyagent avec l'empreinte, un durcissement futur
    // reste retro-compatible avec les comptes existants.
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull(),
    // Le profil de mobilité est un agregat de préférences lu et ecrit en bloc :
    // aucune requête ne porte sur un champ isole, JSON est ici le bon grain.
    // Le driver encode et décodé : les routes ne voient jamais la chaîne.
    profile: text('profile_json', { mode: 'json' }).$type<MobilityProfile>().notNull(),
});

export const sessions = sqliteTable(
    'sessions',
    {
        // Seule l'empreinte SHA-256 du jeton est stockée : une fuite de la base ne
        // permet pas de rejouer une session.
        tokenHash: text('token_hash').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: text('created_at').notNull(),
        expiresAt: text('expires_at').notNull(),
    },
    (t) => [index('idx_sessions_user').on(t.userId)],
);

/** Identité d'une ligne appartenant à un utilisateur : l'identifiant vient du
 *  client, la clé primaire est donc composée avec le proprietaire. */
function ownedColumns() {
    return {
        id: text('id').notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
    };
}

/** Mesures d'un déplacement, communes a tout ce qui en décrit un. */
function measureColumns() {
    return {
        // Les modes sont stockés en JSON dans une colonne texte : la liste est
        // courte, toujours lue en bloc, et jamais interrogee mode par mode. Une
        // table de jointure serait ici du cérémonial sans bénéfice.
        modes: text('modes', { mode: 'json' }).$type<MobilityMode[]>().notNull(),
        distanceKm: real('distance_km').notNull(),
        durationMinutes: real('duration_minutes').notNull(),
        carbonGrams: real('carbon_grams').notNull(),
        // Nullable quand OSRM a mesuré l'option mais pas la référence voiture.
        carbonSavedGrams: real('carbon_saved_grams'),
    };
}

/** Origine et destination, aplaties : SQLite n'a pas de type point. */
function endpointColumns() {
    return {
        originLabel: text('origin_label').notNull(),
        originLat: real('origin_lat').notNull(),
        originLon: real('origin_lon').notNull(),
        destinationLabel: text('destination_label').notNull(),
        destinationLat: real('destination_lat').notNull(),
        destinationLon: real('destination_lon').notNull(),
    };
}

export const tripRecords = sqliteTable(
    'trip_records',
    {
        ...ownedColumns(),
        routeTitle: text('route_title').notNull(),
        ...measureColumns(),
        createdAt: text('created_at').notNull(),
    },
    (t) => [
        primaryKey({ columns: [t.userId, t.id] }),
        index('idx_trip_records_user_date').on(t.userId, desc(t.createdAt)),
    ],
);

// Les statuts viennent du contrat partagé : la colonne, le CHECK et le
// schéma zod ne peuvent pas diverger.
export const plannedTrips = sqliteTable(
    'planned_trips',
    {
        ...ownedColumns(),
        label: text('label').notNull(),
        ...endpointColumns(),
        ...measureColumns(),
        scheduledFor: text('scheduled_for').notNull(),
        status: text('status', { enum: PLANNED_TRIP_STATUSES }).notNull(),
        createdAt: text('created_at').notNull(),
        completedAt: text('completed_at'),
    },
    (t) => [
        primaryKey({ columns: [t.userId, t.id] }),
        index('idx_planned_user_schedule').on(t.userId, t.scheduledFor),
        // `enum` ne contraint que TypeScript ; la garantie en base passe par CHECK.
        check('planned_trips_status', sql`${t.status} IN ('planned', 'done', 'cancelled')`),
    ],
);

export const recurringTrips = sqliteTable(
    'recurring_trips',
    {
        ...ownedColumns(),
        label: text('label').notNull(),
        ...endpointColumns(),
        ...measureColumns(),
        daysOfWeek: text('days_of_week', { mode: 'json' }).$type<number[]>().notNull(),
        timeZone: text('time_zone').notNull().default('Europe/Paris'),
        departureTime: text('departure_time').notNull(),
        returnTime: text('return_time'),
        // Périodes d'activite, lues et écrites en bloc avec la routine : la
        // derniere est ouverte tant qu'elle n'est pas en pause. Aucune requête ne
        // porte sur une période isolée, JSON est le bon grain.
        periods: text('periods_json', { mode: 'json' }).$type<RoutinePeriod[]>().notNull(),
        cancelledPassages: text('cancelled_passages_json', { mode: 'json' }).$type<CancelledPassage[]>().notNull().default([]),
        createdAt: text('created_at').notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const savedRoutes = sqliteTable(
    'saved_routes',
    {
        ...ownedColumns(),
        routeId: text('route_id').notNull(),
        routeTitle: text('route_title').notNull(),
        ...endpointColumns(),
        ...measureColumns(),
        score: real('score').notNull(),
        createdAt: text('created_at').notNull(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.id] })],
);

export const transitFeeds = sqliteTable('transit_feeds', {
    id: text('id').primaryKey(),
    active: integer('active', { mode: 'boolean' }).notNull().default(false),
    metadata: text('metadata', { mode: 'json' }).$type<TimetableMetadata>().notNull(),
    network: text('network', { mode: 'json' }).$type<TransitNetwork>().notNull(),
    transfers: text('transfers', { mode: 'json' }).$type<TimetableTransfer[]>().notNull(),
});

export const transitServiceDays = sqliteTable('transit_service_days', {
    feedId: text('feed_id').notNull().references(() => transitFeeds.id, { onDelete: 'cascade' }),
    serviceId: text('service_id').notNull(),
    date: text('date').notNull(),
}, (t) => [primaryKey({ columns: [t.feedId, t.serviceId, t.date] }), index('idx_transit_date').on(t.feedId, t.date)]);

export const transitTrips = sqliteTable('transit_trips', {
    feedId: text('feed_id').notNull().references(() => transitFeeds.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    serviceId: text('service_id').notNull(),
    // Les passages d'une course se lisent ensemble après sélection par quai.
    trip: text('trip', { mode: 'json' }).$type<TimetableTrip>().notNull(),
}, (t) => [primaryKey({ columns: [t.feedId, t.id] })]);

export const transitBoardings = sqliteTable('transit_boardings', {
    feedId: text('feed_id').notNull().references(() => transitFeeds.id, { onDelete: 'cascade' }),
    tripId: text('trip_id').notNull(),
    stopId: text('stop_id').notNull(),
    departure: integer('departure').notNull(),
}, (t) => [index('idx_transit_boarding').on(t.feedId, t.stopId, t.departure)]);

export const transitShapes = sqliteTable('transit_shapes', {
    feedId: text('feed_id').notNull().references(() => transitFeeds.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    points: text('points', { mode: 'json' }).$type<[number, number][]>().notNull(),
}, (t) => [primaryKey({ columns: [t.feedId, t.id] })]);

// Le réseau publié est importé une fois par version. Les quais ont leurs
// coordonnées en colonnes pour l'index spatial ; les tracés restent par ligne.
export const transportMetadata = sqliteTable('transport_metadata', {
    id: integer('id').primaryKey(),
    version: text('version').notNull(),
    agency: text('agency', { mode: 'json' }).$type<GtfsAgency>().notNull(),
    weather: text('weather', { mode: 'json' }).$type<WeatherSignal>().notNull(),
});
export const transportStops = sqliteTable('transport_stops', {
    id: integer('id').primaryKey(),
    stopId: text('stop_id').notNull().unique(),
    lat: real('lat').notNull(), lon: real('lon').notNull(),
    payload: text('payload', { mode: 'json' }).$type<GtfsStop>().notNull(),
});
export const transportRoutes = sqliteTable('transport_routes', {
    id: text('id').primaryKey(),
    payload: text('payload', { mode: 'json' }).$type<GtfsRoute>().notNull(),
});
export const transportTrips = sqliteTable('transport_trips', {
    id: text('id').primaryKey(),
    payload: text('payload', { mode: 'json' }).$type<GtfsTrip>().notNull(),
});
