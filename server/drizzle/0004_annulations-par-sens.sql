DROP INDEX `idx_trip_records_user_date`;--> statement-breakpoint
CREATE INDEX `idx_trip_records_user_date` ON `trip_records` (`user_id`,"created_at" desc);--> statement-breakpoint
ALTER TABLE `recurring_trips` ADD `time_zone` text DEFAULT 'Europe/Paris' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_trips` ADD `cancelled_passages_json` text DEFAULT '[]' NOT NULL;