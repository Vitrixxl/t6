CREATE TABLE `transit_boardings` (
	`feed_id` text NOT NULL,
	`trip_id` text NOT NULL,
	`stop_id` text NOT NULL,
	`departure` integer NOT NULL,
	FOREIGN KEY (`feed_id`) REFERENCES `transit_feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_transit_boarding` ON `transit_boardings` (`feed_id`,`stop_id`,`departure`);--> statement-breakpoint
CREATE TABLE `transit_feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`metadata` text NOT NULL,
	`network` text NOT NULL,
	`transfers` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transit_service_days` (
	`feed_id` text NOT NULL,
	`service_id` text NOT NULL,
	`date` text NOT NULL,
	PRIMARY KEY(`feed_id`, `service_id`, `date`),
	FOREIGN KEY (`feed_id`) REFERENCES `transit_feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_transit_date` ON `transit_service_days` (`feed_id`,`date`);--> statement-breakpoint
CREATE TABLE `transit_shapes` (
	`feed_id` text NOT NULL,
	`id` text NOT NULL,
	`points` text NOT NULL,
	PRIMARY KEY(`feed_id`, `id`),
	FOREIGN KEY (`feed_id`) REFERENCES `transit_feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transit_trips` (
	`feed_id` text NOT NULL,
	`id` text NOT NULL,
	`service_id` text NOT NULL,
	`trip` text NOT NULL,
	PRIMARY KEY(`feed_id`, `id`),
	FOREIGN KEY (`feed_id`) REFERENCES `transit_feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
