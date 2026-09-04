// Schema de la base, source unique pour Drizzle.
//
// Chaque table est declaree une fois ici ; drizzle-kit en derive les
// migrations SQL (server/drizzle/) et Drizzle en derive le type des lignes.
// Les colonnes gardent leur nom snake_case en base pour rester lisibles a un
// DBA, et prennent un nom camelCase cote TypeScript pour coller au domaine.
import { desc, sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { PLANNED_TRIP_STATUSES } from '../../../src/contracts/trips.ts';
import type { MobilityMode, MobilityProfile, RoutinePeriod } from '../../../src/types.ts';

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    displayName: text('display_name').notNull(),
    // Empreinte argon2id auto-decrite ($argon2id$v=19$m=...,t=...,p=...$...) :
    // les parametres de cout voyagent avec l'empreinte, un durcissement futur
    // reste retro-compatible avec les comptes existants.
    passwordHash: text('password_hash').notNull(),
    createdAt: text('created_at').notNull(),
    // Le profil de mobilite est un agregat de preferences lu et ecrit en bloc :
    // aucune requete ne porte sur un champ isole, JSON est ici le bon grain.
    // Le driver encode et decode : les routes ne voient jamais la chaine.
    profile: text('profile_json', { mode: 'json' }).$type<MobilityProfile>().notNull(),
});

export const sessions = sqliteTable(
    'sessions',
    {
        // Seule l'empreinte SHA-256 du jeton est stockee : une fuite de la base ne
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

/** Identite d'une ligne appartenant a un utilisateur : l'identifiant vient du
 *  client, la cle primaire est donc composee avec le proprietaire. */
function ownedColumns() {
    return {
        id: text('id').notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
    };
}

/** Mesures d'un deplacement, communes a tout ce qui en decrit un. */
function measureColumns() {
    return {
        // Les modes sont stockes en JSON dans une colonne texte : la liste est
        // courte, toujours lue en bloc, et jamais interrogee mode par mode. Une
        // table de jointure serait ici du ceremonial sans benefice.
        modes: text('modes', { mode: 'json' }).$type<MobilityMode[]>().notNull(),
        distanceKm: real('distance_km').notNull(),
        durationMinutes: real('duration_minutes').notNull(),
        carbonGrams: real('carbon_grams').notNull(),
        // Nullable quand OSRM a mesure l'option mais pas la reference voiture.
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

// Les statuts viennent du contrat partage : la colonne, le CHECK et le
// schema zod ne peuvent pas diverger.
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
        departureTime: text('departure_time').notNull(),
        returnTime: text('return_time'),
        // Periodes d'activite, lues et ecrites en bloc avec la routine : la
        // derniere est ouverte tant qu'elle n'est pas en pause. Aucune requete ne
        // porte sur une periode isolee, JSON est le bon grain.
        periods: text('periods_json', { mode: 'json' }).$type<RoutinePeriod[]>().notNull(),
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

// Traces de voirie deja calcules. Le cache est partage par tous les clients :
// une recherche frequente n'atteint la source qu'une fois, ce qui protege le
// quota du fournisseur et rend l'application utilisable quand il refuse de
// repondre (eco-conception, et B13).
//
// La cle porte les coordonnees arrondies a cinq decimales, soit environ un
// metre : deux departs distants d'un metre suivent la meme rue, inutile de
// calculer deux fois.
export const routeCache = sqliteTable(
    'route_cache',
    {
        cacheKey: text('cache_key').primaryKey(),
        mode: text('mode').notNull(),
        // Blob opaque pour la couche depot : c'est le service de routage qui en
        // connait la forme.
        payloadJson: text('payload_json').notNull(),
        /** Horodatage en millisecondes (Date.now()), compare au TTL. */
        createdAt: integer('created_at').notNull(),
    },
    (t) => [index('idx_route_cache_date').on(t.createdAt)],
);
