ALTER TABLE `transport_metadata` DROP COLUMN `weather`;--> statement-breakpoint
UPDATE `users` SET `profile_json` = json_remove(`profile_json`, '$.avoidRain');
