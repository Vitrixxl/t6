ALTER TABLE `saved_routes` DROP COLUMN `score`;
--> statement-breakpoint
UPDATE users SET profile_json = json_set(
    json_remove(profile_json, '$.preferredModes', '$.routePreselection'),
    '$.availableModes', json('["bike","scooter","transit"]'),
    '$.onboardedAt', NULL
);
