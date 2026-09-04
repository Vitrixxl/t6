PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_planned_trips` (
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
	`carbon_saved_grams` real,
	`scheduled_for` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`completed_at` text,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "planned_trips_status" CHECK("__new_planned_trips"."status" IN ('planned', 'done', 'cancelled'))
);
--> statement-breakpoint
INSERT INTO `__new_planned_trips`("id", "user_id", "label", "origin_label", "origin_lat", "origin_lon", "destination_label", "destination_lat", "destination_lon", "modes", "distance_km", "duration_minutes", "carbon_grams", "carbon_saved_grams", "scheduled_for", "status", "created_at", "completed_at") SELECT "id", "user_id", "label", "origin_label", "origin_lat", "origin_lon", "destination_label", "destination_lat", "destination_lon", "modes", "distance_km", "duration_minutes", "carbon_grams", "carbon_saved_grams", "scheduled_for", "status", "created_at", "completed_at" FROM `planned_trips`;--> statement-breakpoint
DROP TABLE `planned_trips`;--> statement-breakpoint
ALTER TABLE `__new_planned_trips` RENAME TO `planned_trips`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_planned_user_schedule` ON `planned_trips` (`user_id`,`scheduled_for`);--> statement-breakpoint
CREATE TABLE `__new_recurring_trips` (
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
	`carbon_saved_grams` real,
	`days_of_week` text NOT NULL,
	`departure_time` text NOT NULL,
	`return_time` text,
	`periods_json` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_recurring_trips`("id", "user_id", "label", "origin_label", "origin_lat", "origin_lon", "destination_label", "destination_lat", "destination_lon", "modes", "distance_km", "duration_minutes", "carbon_grams", "carbon_saved_grams", "days_of_week", "departure_time", "return_time", "periods_json", "created_at") SELECT "id", "user_id", "label", "origin_label", "origin_lat", "origin_lon", "destination_label", "destination_lat", "destination_lon", "modes", "distance_km", "duration_minutes", "carbon_grams", "carbon_saved_grams", "days_of_week", "departure_time", "return_time", "periods_json", "created_at" FROM `recurring_trips`;--> statement-breakpoint
DROP TABLE `recurring_trips`;--> statement-breakpoint
ALTER TABLE `__new_recurring_trips` RENAME TO `recurring_trips`;--> statement-breakpoint
CREATE TABLE `__new_saved_routes` (
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
	`carbon_saved_grams` real,
	`score` real NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_saved_routes`("id", "user_id", "route_id", "route_title", "origin_label", "origin_lat", "origin_lon", "destination_label", "destination_lat", "destination_lon", "modes", "distance_km", "duration_minutes", "carbon_grams", "carbon_saved_grams", "score", "created_at") SELECT "id", "user_id", "route_id", "route_title", "origin_label", "origin_lat", "origin_lon", "destination_label", "destination_lat", "destination_lon", "modes", "distance_km", "duration_minutes", "carbon_grams", "carbon_saved_grams", "score", "created_at" FROM `saved_routes`;--> statement-breakpoint
DROP TABLE `saved_routes`;--> statement-breakpoint
ALTER TABLE `__new_saved_routes` RENAME TO `saved_routes`;--> statement-breakpoint
CREATE TABLE `__new_trip_records` (
	`id` text NOT NULL,
	`user_id` text NOT NULL,
	`route_title` text NOT NULL,
	`modes` text NOT NULL,
	`distance_km` real NOT NULL,
	`duration_minutes` real NOT NULL,
	`carbon_grams` real NOT NULL,
	`carbon_saved_grams` real,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_trip_records`("id", "user_id", "route_title", "modes", "distance_km", "duration_minutes", "carbon_grams", "carbon_saved_grams", "created_at") SELECT "id", "user_id", "route_title", "modes", "distance_km", "duration_minutes", "carbon_grams", "carbon_saved_grams", "created_at" FROM `trip_records`;--> statement-breakpoint
DROP TABLE `trip_records`;--> statement-breakpoint
ALTER TABLE `__new_trip_records` RENAME TO `trip_records`;--> statement-breakpoint
CREATE INDEX `idx_trip_records_user_date` ON `trip_records` (`user_id`,`created_at` DESC);
