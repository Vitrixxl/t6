CREATE TABLE `transport_metadata` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`agency` text NOT NULL,
	`weather` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transport_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transport_stops` (
	`id` integer PRIMARY KEY NOT NULL,
	`stop_id` text NOT NULL,
	`lat` real NOT NULL,
	`lon` real NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transport_stops_stop_id_unique` ON `transport_stops` (`stop_id`);--> statement-breakpoint
CREATE TABLE `transport_trips` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
