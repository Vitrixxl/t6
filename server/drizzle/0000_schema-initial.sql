-- Migration initiale : reprise du schema anterieur (server/src/db/schema.sql,
-- applique jusque-la par CREATE TABLE IF NOT EXISTS au demarrage).
--
-- Les IF NOT EXISTS sont ajoutes a la main pour qu'une base creee avant
-- Drizzle soit adoptee telle quelle : la migration s'enregistre comme
-- appliquee sans toucher aux tables ni aux donnees existantes. Les migrations
-- suivantes, generees par drizzle-kit, ne portent que des changements.
CREATE TABLE IF NOT EXISTS `applied_operations` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`applied_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_applied_operations_date` ON `applied_operations` (`applied_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `planned_trips` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`origin_label` text NOT NULL,
	`origin_lat` real NOT NULL,
	`origin_lon` real NOT NULL,
	`destination_label` text NOT NULL,
	`destination_lat` real NOT NULL,
	`destination_lon` real NOT NULL,
	`modes` text NOT NULL,
	`distance_km` real NOT NULL,
	`duration_minutes` real NOT NULL,
	`carbon_grams` real NOT NULL,
	`carbon_saved_grams` real NOT NULL,
	`scheduled_for` text NOT NULL,
	`status` text NOT NULL,
	`recurring_trip_id` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "planned_trips_status" CHECK("planned_trips"."status" IN ('planned', 'done', 'cancelled'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_planned_user_schedule` ON `planned_trips` (`user_id`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recurring_trips` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`origin_label` text NOT NULL,
	`origin_lat` real NOT NULL,
	`origin_lon` real NOT NULL,
	`destination_label` text NOT NULL,
	`destination_lat` real NOT NULL,
	`destination_lon` real NOT NULL,
	`modes` text NOT NULL,
	`distance_km` real NOT NULL,
	`duration_minutes` real NOT NULL,
	`carbon_grams` real NOT NULL,
	`carbon_saved_grams` real NOT NULL,
	`days_of_week` text NOT NULL,
	`departure_time` text NOT NULL,
	`return_time` text,
	`paused` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `route_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_route_cache_date` ON `route_cache` (`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `saved_routes` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`route_id` text NOT NULL,
	`route_title` text NOT NULL,
	`origin_label` text NOT NULL,
	`origin_lat` real NOT NULL,
	`origin_lon` real NOT NULL,
	`destination_label` text NOT NULL,
	`destination_lat` real NOT NULL,
	`destination_lon` real NOT NULL,
	`modes` text NOT NULL,
	`distance_km` real NOT NULL,
	`duration_minutes` real NOT NULL,
	`carbon_grams` real NOT NULL,
	`carbon_saved_grams` real NOT NULL,
	`score` real NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `trip_records` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`route_title` text NOT NULL,
	`modes` text NOT NULL,
	`distance_km` real NOT NULL,
	`duration_minutes` real NOT NULL,
	`carbon_grams` real NOT NULL,
	`carbon_saved_grams` real NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_trip_records_user_date` ON `trip_records` (`user_id`,"created_at" DESC);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`profile_json` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);